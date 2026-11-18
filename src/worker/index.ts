import type { RuntimeLlmConfig } from "@/ai/llm";
import { decryptSecret } from "@/lib/crypto/encryption";
import { getConfig } from "@/lib/config/get-config";
import { logEvent } from "@/lib/logger";
import { normalisePersonName } from "@/lib/names";
import {
  getAssesseeById,
  listAssesseesByBatch,
  saveNameJuryVerdictAndOcr,
  upsertAssesseesForBatch,
} from "@/repositories/assessees.repository";
import {
  saveAk05ReportForBatch,
  saveDitAnalysis,
  saveSimilarityPairsForBatch,
  saveWrittenGrading,
} from "@/repositories/assessment.repository";
import { getAssessorProfile } from "@/repositories/auth.repository";
import {
  getBatchById,
  listDriveFilesForBatch,
  updateDriveFileExtraction,
  upsertDriveFilesForBatch,
} from "@/repositories/batches.repository";
import { getLatestProviderConfigForAssessor } from "@/repositories/provider.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { getActiveSignature } from "@/repositories/signatures.repository";
import { runDitPipeline } from "@/services/dit";
import {
  classifyDriveFileName,
  crawlPublicDriveFolder,
  extractDriveFolderId,
  inferCandidateNameFromDrivePath,
} from "@/services/drive";
import { extractTextFromBuffer } from "@/services/extract";
import {
  downloadPublicDriveFileBuffer,
  ensureDriveFileExtracted,
  resolveAssesseeDitInputs,
} from "@/services/drive-extract";
import { resolveWrittenTestFiles, runWrittenGradingPipeline } from "@/services/grading";
import { runNameJury } from "@/services/name-jury";
import {
  DEFAULT_SIMILARITY_THRESHOLDS,
  evaluateSimilarityPair,
} from "@/services/similarity";
import { resolveAk05BatchRows } from "@/lib/ak05/rollup";
import {
  resolveUnitsForScheme,
  syncAssesseeVatmRecommendations,
} from "@/lib/forms/sync-vatm-decisions";
import { handleHelloJob } from "./handlers/hello.handler";

export interface WorkerJobInput {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  userId?: string;
}

export interface WorkerJobResult {
  status: "done";
  progress: number;
  meta?: Record<string, unknown>;
}

function requireUserId(job: WorkerJobInput): string {
  if (!job.userId) {
    throw new Error(`WORKER_CONTEXT_ERROR: Job ${job.id} (${job.type}) memerlukan userId.`);
  }
  return job.userId;
}

async function resolveOptionalLlmConfig(
  userId: string,
): Promise<RuntimeLlmConfig | undefined> {
  const stored = await getLatestProviderConfigForAssessor(userId);
  if (!stored) return undefined;

  return {
    provider: stored.provider,
    apiKey: decryptSecret(stored.encryptedApiKey),
    baseUrl: stored.baseUrl,
    gatewayToken: stored.encryptedGatewayToken
      ? decryptSecret(stored.encryptedGatewayToken)
      : null,
    model: stored.model,
    temperature: stored.temperature,
    maxTokens: stored.maxTokens,
  };
}

async function resolveOptionalDriveApiKey(
  userId: string,
): Promise<string | undefined> {
  const storedProvider = await getLatestProviderConfigForAssessor(userId);
  if (!storedProvider?.googleDriveApiKeyEncrypted) return undefined;
  try {
    return decryptSecret(storedProvider.googleDriveApiKeyEncrypted) || undefined;
  } catch {
    return undefined;
  }
}

async function requireLlmConfig(userId: string): Promise<RuntimeLlmConfig> {
  const cfg = await resolveOptionalLlmConfig(userId);
  if (!cfg) {
    throw new Error(
      "PROVIDER_NOT_CONFIGURED: Konfigurasi Penyedia AI (BYOK) belum diatur di Pengaturan → Penyedia AI.",
    );
  }
  return cfg;
}

async function handleDriveScanJob(job: WorkerJobInput): Promise<WorkerJobResult> {
  const userId = requireUserId(job);
  const batchId = String(job.payload.batchId ?? "");
  if (!batchId) {
    throw new Error("VALIDATION_ERROR: drive_scan memerlukan batchId.");
  }

  const batch = await getBatchById(userId, batchId);
  if (!batch) {
    throw new Error(`NOT_FOUND: Batch ${batchId} tidak ditemukan.`);
  }

  if (Array.isArray(job.payload.files)) {
    const classified = job.payload.files
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item, idx) => {
        const fileName = String(item.fileName ?? `file-${idx + 1}`);
        const drivePath = String(item.drivePath ?? fileName);
        const cls = classifyDriveFileName(fileName, drivePath);
        return {
          driveFileId: String(item.driveFileId ?? `manual-${idx + 1}`),
          fileName,
          mimeType: String(item.mimeType ?? "application/octet-stream"),
          drivePath,
          docType: typeof item.docType === "string" ? item.docType : cls.docType,
          confidence:
            typeof item.confidence === "number" ? item.confidence : cls.confidence,
          extractedText:
            typeof item.extractedText === "string" ? item.extractedText : null,
          extractionMethod:
            typeof item.extractionMethod === "string" ? item.extractionMethod : null,
        };
      });

    const savedCount = await upsertDriveFilesForBatch({
      userId,
      lspId: batch.lspId,
      batchId: batch.id,
      files: classified,
    });

    return {
      status: "done",
      progress: 100,
      meta: { scannedFiles: savedCount, mode: "payload" },
    };
  }

  const driveUrl = String(job.payload.driveFolderUrl ?? batch.driveFolderUrl ?? "");
  const folderId = driveUrl ? extractDriveFolderId(driveUrl) : null;
  if (!folderId) {
    throw new Error("INVALID_DRIVE_URL: URL folder Google Drive batch tidak valid.");
  }

  const payloadApiKey =
    typeof job.payload.apiKey === "string" ? job.payload.apiKey.trim() : "";
  const driveApiKey =
    payloadApiKey || (await resolveOptionalDriveApiKey(userId)) || "";

  const discovered = await crawlPublicDriveFolder({
    folderId,
    apiKey: driveApiKey || undefined,
  });

  const inferredPerFile = discovered.map((f) => ({
    file: f,
    candidateName: inferCandidateNameFromDrivePath(f.drivePath, f.fileName),
  }));

  const candidateNames = Array.from(
    new Set(
      inferredPerFile
        .map((x) => x.candidateName)
        .filter((n): n is string => Boolean(n && n.length > 1)),
    ),
  );

  const assesseeRecords =
    candidateNames.length > 0
      ? await upsertAssesseesForBatch({
          userId,
          lspId: batch.lspId,
          batchId: batch.id,
          names: candidateNames,
        })
      : await listAssesseesByBatch(userId, batch.id);

  const enrichedFiles = inferredPerFile.map(({ file, candidateName }) => {
    if (!candidateName) {
      return {
        ...file,
        assesseeId: null,
        triageStatus:
          file.docType === "materi_pelatihan"
            ? ("not_needed" as const)
            : ("unmatched" as const),
      };
    }
    const candNorm = normalisePersonName(candidateName);
    const matched = assesseeRecords.find((a) => {
      const aNorm = normalisePersonName(a.displayName);
      return (
        Boolean(aNorm && candNorm) &&
        (aNorm === candNorm || aNorm.includes(candNorm) || candNorm.includes(aNorm))
      );
    });
    return {
      ...file,
      assesseeId: matched?.id ?? null,
      triageStatus: matched ? ("assigned" as const) : ("unmatched" as const),
    };
  });

  const savedCount = await upsertDriveFilesForBatch({
    userId,
    lspId: batch.lspId,
    batchId: batch.id,
    files: enrichedFiles,
  });

  return {
    status: "done",
    progress: 100,
    meta: {
      scannedFiles: savedCount,
      discoveredAssessees: assesseeRecords.length,
      folderId,
    },
  };
}

async function handleExtractFileJob(job: WorkerJobInput): Promise<WorkerJobResult> {
  const userId = requireUserId(job);
  const fileId = String(job.payload.fileId ?? "");
  if (!fileId) {
    throw new Error("VALIDATION_ERROR: extract_file memerlukan fileId.");
  }

  const mimeType = String(job.payload.mimeType ?? "").toLowerCase();
  const fileName = String(job.payload.fileName ?? "");
  const base64Content =
    typeof job.payload.base64Content === "string" ? job.payload.base64Content : "";
  const driveFileId =
    typeof job.payload.driveFileId === "string" ? job.payload.driveFileId.trim() : "";
  const rawText = typeof job.payload.text === "string" ? job.payload.text : "";

  let extractedText = rawText.trim();
  let extractionMethod = "raw_text";

  if (base64Content) {
    const buffer = Buffer.from(base64Content, "base64");
    const parsed = await extractTextFromBuffer({
      buffer,
      fileName: fileName || "document.docx",
      mimeType,
    });
    extractedText = parsed.text;
    extractionMethod = parsed.extractionMethod;
  } else if (!extractedText && driveFileId) {
    const driveApiKey = await resolveOptionalDriveApiKey(userId);
    const buffer = await downloadPublicDriveFileBuffer({
      driveFileId,
      apiKey: driveApiKey,
    });
    const parsed = await extractTextFromBuffer({
      buffer,
      fileName: fileName || "document.docx",
      mimeType,
    });
    extractedText = parsed.text;
    extractionMethod = parsed.extractionMethod;
  }

  if (!extractedText) {
    throw new Error("UNPROCESSABLE: Tidak ada teks yang dapat diekstrak dari berkas.");
  }

  await updateDriveFileExtraction({
    userId,
    fileId,
    extractedText,
    extractionMethod,
  });

  return {
    status: "done",
    progress: 100,
    meta: { fileId, extractionMethod, chars: extractedText.length },
  };
}

async function handleOcrKtpJob(job: WorkerJobInput): Promise<WorkerJobResult> {
  const userId = requireUserId(job);
  const assesseeId = String(job.payload.assesseeId ?? "");
  if (!assesseeId) {
    throw new Error("VALIDATION_ERROR: ocr_ktp memerlukan assesseeId.");
  }

  const assessee = await getAssesseeById(userId, assesseeId);
  if (!assessee) {
    throw new Error(`NOT_FOUND: Asesi ${assesseeId} tidak ditemukan.`);
  }

  const ktpNameOcr = String(job.payload.ktpText ?? assessee.ktpNameOcr ?? "").trim();
  const ocrConfidence =
    typeof job.payload.ocrConfidence === "number" ? job.payload.ocrConfidence : 0.9;
  const ocrConfidenceFloor =
    typeof job.payload.ocrConfidenceFloor === "number"
      ? job.payload.ocrConfidenceFloor
      : 0.75;

  const llmConfig = await resolveOptionalLlmConfig(userId);
  const thresholds = (await getConfig("name_jury.thresholds", { lspId: assessee.lspId })) ?? undefined;

  const jury = await runNameJury({
    nameKtpOcr: ktpNameOcr,
    nameApl01: assessee.apl01Name ?? assessee.displayName,
    nameSuratTugas: assessee.suratTugasName ?? "",
    nameIjazah: assessee.ijazahName ?? "",
    ocrConfidence,
    ocrConfidenceFloor,
    thresholds,
    llmConfig,
    correlationId: job.id,
  });

  await saveNameJuryVerdictAndOcr({
    userId,
    lspId: assessee.lspId,
    assesseeId: assessee.id,
    ktpNameOcr: ktpNameOcr || undefined,
    verdict: jury.result.verdict,
    proposedCertificateName: jury.result.proposed_certificate_name,
    reasoning: jury.result.reasoning,
    evidence: jury.result.evidence,
    ocrConfidence: jury.result.ocr_confidence,
    model: llmConfig ? `${llmConfig.provider}/${llmConfig.model}` : "deterministic-rule-30",
    promptVersion: jury.promptVersion,
  });

  return {
    status: "done",
    progress: 100,
    meta: { assesseeId: assessee.id, verdict: jury.result.verdict },
  };
}

async function handleDitAnalysisJob(job: WorkerJobInput): Promise<WorkerJobResult> {
  const userId = requireUserId(job);
  const assesseeId = String(job.payload.assesseeId ?? "");
  if (!assesseeId) {
    throw new Error("VALIDATION_ERROR: dit_analysis memerlukan assesseeId.");
  }

  const assessee = await getAssesseeById(userId, assesseeId);
  if (!assessee) {
    throw new Error(`NOT_FOUND: Asesi ${assesseeId} tidak ditemukan.`);
  }

  const batch = await getBatchById(userId, assessee.batchId);
  if (!batch) {
    throw new Error(`NOT_FOUND: Batch ${assessee.batchId} tidak ditemukan.`);
  }

  const files = await listDriveFilesForBatch(userId, batch.id);
  const assesseeFiles = files.filter((f) => f.assesseeId === assessee.id);

  const payload04a = typeof job.payload.frIa04aText === "string" ? job.payload.frIa04aText.trim() : "";
  const payload04b =
    typeof job.payload.presentationTranscript === "string"
      ? job.payload.presentationTranscript.trim()
      : "";
  const payloadCv =
    typeof job.payload.candidateProfileSummary === "string"
      ? job.payload.candidateProfileSummary.trim()
      : "";

  const driveApiKey =
    !payload04a || !payload04b || !payloadCv
      ? await resolveOptionalDriveApiKey(userId)
      : undefined;
  const resolvedInputs =
    !payload04a || !payload04b || !payloadCv
      ? await resolveAssesseeDitInputs({
          userId,
          files: assesseeFiles,
          apiKey: driveApiKey,
        })
      : null;

  const frIa04aText = payload04a || resolvedInputs?.frIa04aText || "";
  const presentationTranscript = payload04b || resolvedInputs?.presentationTranscript || "";
  const candidateProfileSummary = payloadCv || resolvedInputs?.candidateProfileSummary || "";

  const schemes = await listSchemes(userId, assessee.lspId);
  const scheme = schemes.find((s) => s.id === batch.schemeId);
  const llmConfig = await requireLlmConfig(userId);

  const result = await runDitPipeline({
    pseudonym: assessee.pseudonym ?? "ASESI-001",
    schemeName: scheme?.name ?? batch.name,
    schemeQuestionCount: scheme?.manifest?.questionCounts?.questionBankCount,
    legalRefs: scheme?.manifest?.decisionRuleRef ? [scheme.manifest.decisionRuleRef] : [],
    frIa04aText,
    presentationTranscript,
    candidateProfileSummary,
    llmConfig,
    correlationId: job.id,
  });

  if (!result.ok) {
    throw new Error(
      "error" in result && result.error ? result.error : `DIT_FAILED: ${result.reason}`,
    );
  }

  await saveDitAnalysis({
    userId,
    lspId: assessee.lspId,
    batchId: batch.id,
    assesseeId: assessee.id,
    model: `${llmConfig.provider}/${llmConfig.model}`,
    promptVersion: result.promptVersion,
    coverageMatrix: result.output.coverageMatrix,
    gapQuestions: result.output.gapQuestions,
    questionBank: result.output.questionBank,
    modelAnswers: result.output.questionBank.map((q) => ({
      no: q.no,
      modelAnswerKeyPoints: q.modelAnswerKeyPoints,
    })),
    readiness: result.output.readiness,
    official04b: {
      officialQuestionCount: scheme?.manifest?.questionCounts?.official04bCount ?? null,
      decisionRule: scheme?.manifest?.decisionRule ?? "VATM",
    },
    status: "done",
    rawOutput: result.output,
  });

  await syncAssesseeVatmRecommendations({
    userId,
    lspId: assessee.lspId,
    batchId: batch.id,
    assesseeId: assessee.id,
    scheme,
  });

  return {
    status: "done",
    progress: 100,
    meta: { assesseeId: assessee.id, questionBankSize: result.output.questionBank.length },
  };
}

async function handleWrittenGradingJob(job: WorkerJobInput): Promise<WorkerJobResult> {
  const userId = requireUserId(job);
  const assesseeId = String(job.payload.assesseeId ?? "");
  if (!assesseeId) {
    throw new Error("VALIDATION_ERROR: written_grading memerlukan assesseeId.");
  }

  const assessee = await getAssesseeById(userId, assesseeId);
  if (!assessee) {
    throw new Error(`NOT_FOUND: Asesi ${assesseeId} tidak ditemukan.`);
  }

  const batch = await getBatchById(userId, assessee.batchId);
  if (!batch) {
    throw new Error(`NOT_FOUND: Batch ${assessee.batchId} tidak ditemukan.`);
  }

  const schemes = await listSchemes(userId, assessee.lspId);
  const scheme = schemes.find((s) => s.id === batch.schemeId);
  const configuredMapping = await getConfig("form_mapping.06", { lspId: assessee.lspId });
  const mapping = scheme?.manifest?.formSuffixMapping ??
    configuredMapping ?? {
      soal: "06A",
      kunci: "06B",
      jawaban: "06C",
    };

  const files = await listDriveFilesForBatch(userId, batch.id);
  const relevantDocTypes = new Set([
    mapping.soal.toLowerCase(),
    mapping.kunci.toLowerCase(),
    mapping.jawaban.toLowerCase(),
  ]);
  const candidateFiles = files.filter(
    (f) => (!f.assesseeId || f.assesseeId === assessee.id) && relevantDocTypes.has(f.docType.toLowerCase()),
  );
  const needsDriveExtraction =
    (!job.payload.masterKeyText || !job.payload.studentAnswerText) &&
    candidateFiles.some((f) => !f.extractedText);
  const driveApiKey = needsDriveExtraction
    ? await resolveOptionalDriveApiKey(userId)
    : undefined;

  const byDocType: Record<string, string> = {};
  for (const f of candidateFiles) {
    let text = f.extractedText ?? "";
    if (!text) {
      const extracted = await ensureDriveFileExtracted({
        userId,
        file: f,
        apiKey: driveApiKey,
      });
      text = extracted.text ?? "";
    }
    if (!text) continue;
    byDocType[f.docType.toUpperCase()] = text;
    byDocType[f.docType.toLowerCase()] = text;
  }

  const resolved = resolveWrittenTestFiles(byDocType, mapping);
  const masterKeyText = String(job.payload.masterKeyText ?? resolved.kunciText);
  const studentAnswerText = String(job.payload.studentAnswerText ?? resolved.jawabanText);

  const llmConfig = await requireLlmConfig(userId);
  const graded = await runWrittenGradingPipeline({
    pseudonym: assessee.pseudonym ?? "ASESI-001",
    schemeName: scheme?.name ?? batch.name,
    units: resolveUnitsForScheme(scheme),
    masterKeyText,
    studentAnswerText,
    llmConfig,
    correlationId: job.id,
  });

  if (!graded.ok) {
    throw new Error(graded.error);
  }

  await saveWrittenGrading({
    userId,
    lspId: assessee.lspId,
    batchId: batch.id,
    assesseeId: assessee.id,
    formMapping: mapping,
    itemVerdicts: graded.output.itemVerdicts,
    errorSummary: graded.output.ringkasanKesalahan,
    vatmUnitRecommendations: graded.output.vatmUnitRecommendations,
    plagiarismReport: graded.output.plagiarismReport,
    model: `${llmConfig.provider}/${llmConfig.model}`,
    promptVersion: graded.promptVersion,
  });

  await syncAssesseeVatmRecommendations({
    userId,
    lspId: assessee.lspId,
    batchId: batch.id,
    assesseeId: assessee.id,
    scheme,
  });

  return {
    status: "done",
    progress: 100,
    meta: { assesseeId: assessee.id, gradedItems: graded.output.itemVerdicts.length },
  };
}

async function handleSimilarityRunJob(job: WorkerJobInput): Promise<WorkerJobResult> {
  const userId = requireUserId(job);
  const batchId = String(job.payload.batchId ?? "");
  if (!batchId) {
    throw new Error("VALIDATION_ERROR: similarity_run memerlukan batchId.");
  }

  const batch = await getBatchById(userId, batchId);
  if (!batch) {
    throw new Error(`NOT_FOUND: Batch ${batchId} tidak ditemukan.`);
  }

  const thresholds = (await getConfig("similarity.flag_thresholds", {
    lspId: batch.lspId,
  })) ?? { ...DEFAULT_SIMILARITY_THRESHOLDS };

  const files = await listDriveFilesForBatch(userId, batchId);
  const assessees = await listAssesseesByBatch(userId, batchId);
  const answerDocType = String(job.payload.docType ?? "06c").toLowerCase();
  const dbScope: "dit" | "written" =
    answerDocType === "dit" || answerDocType.startsWith("04") ? "dit" : "written";

  let entries: Array<{ assesseeId: string; text: string }>;
  if (Array.isArray(job.payload.submissions)) {
    entries = job.payload.submissions
      .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === "object"))
      .map((s) => ({
        assesseeId: String(s.assesseeId ?? ""),
        text: String(s.text ?? ""),
      }))
      .filter((s) => s.assesseeId && s.text.trim().length > 0);
  } else {
    const driveApiKey = await resolveOptionalDriveApiKey(userId);
    const resolved: Array<{ assesseeId: string; text: string }> = [];
    const CHUNK = 5;
    for (let i = 0; i < assessees.length; i += CHUNK) {
      const slice = assessees.slice(i, i + CHUNK);
      const batchTexts = await Promise.all(
        slice.map(async (a) => {
          const targetFile = files.find(
            (f) => f.assesseeId === a.id && f.docType.toLowerCase() === answerDocType,
          );
          if (!targetFile) return { assesseeId: a.id, text: "" };
          const outcome = await ensureDriveFileExtracted({
            userId,
            file: targetFile,
            apiKey: driveApiKey,
          });
          return { assesseeId: a.id, text: outcome.text ?? "" };
        }),
      );
      resolved.push(...batchTexts);
    }
    entries = resolved.filter((s) => s.text.trim().length > 0);
  }

  const pairs: Array<{
    scope: string;
    assesseeAId: string;
    assesseeBId: string;
    jaccardScore: number;
    tfidfCosine: number;
    sharedSpans: unknown;
    verdict: string;
  }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entryA = entries[i];
    if (!entryA) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const entryB = entries[j];
      if (!entryB) continue;
      const metrics = evaluateSimilarityPair(entryA.text, entryB.text, thresholds);
      if (metrics.flagLevel !== "clean") {
        pairs.push({
          scope: dbScope,
          assesseeAId: entryA.assesseeId,
          assesseeBId: entryB.assesseeId,
          jaccardScore: metrics.jaccardScore,
          tfidfCosine: metrics.tfidfCosine,
          sharedSpans: metrics.sharedSpans,
          verdict: "perlu_ditinjau",
        });
      }
    }
  }

  await saveSimilarityPairsForBatch({
    userId,
    lspId: batch.lspId,
    batchId: batch.id,
    pairs,
  });

  return {
    status: "done",
    progress: 100,
    meta: { comparedAssessees: entries.length, flaggedPairs: pairs.length },
  };
}

async function handleAk05ExportJob(job: WorkerJobInput): Promise<WorkerJobResult> {
  const userId = requireUserId(job);
  const batchId = String(job.payload.batchId ?? "");
  if (!batchId) {
    throw new Error("VALIDATION_ERROR: ak05_export memerlukan batchId.");
  }

  const batch = await getBatchById(userId, batchId);
  if (!batch) {
    throw new Error(`NOT_FOUND: Batch ${batchId} tidak ditemukan.`);
  }

  const signature = await getActiveSignature(userId);
  if (!signature) {
    throw new Error(
      "NO_ACTIVE_SIGNATURE: Tanda tangan aktif asesor wajib diunggah sebelum finalisasi AK.05.",
    );
  }

  const assessees = await listAssesseesByBatch(userId, batchId);
  const unconfirmed = assessees.filter((a) => !a.certificateNameConfirmed);
  if (unconfirmed.length > 0) {
    throw new Error(
      `UNPROCESSABLE: ${unconfirmed.length} asesi belum memiliki konfirmasi nama sertifikat.`,
    );
  }

  const profile = await getAssessorProfile(userId);
  const rows = await resolveAk05BatchRows(userId, batchId, assessees);

  await saveAk05ReportForBatch({
    userId,
    lspId: batch.lspId,
    batchId: batch.id,
    assessorId: userId,
    assessorRegNo:
      (profile?.regNoMet as string | null | undefined) ??
      (profile?.reg_no_met as string | null | undefined) ??
      null,
    tukType: batch.tukType ?? "sewaktu",
    status: "draft",
    rows,
    notesPositiveNegative: String(job.payload.notesPositiveNegative ?? ""),
    notesRejection: String(job.payload.notesRejection ?? ""),
    notesImprovement: String(job.payload.notesImprovement ?? ""),
    signatureId: signature.id,
  });

  return {
    status: "done",
    progress: 100,
    meta: { batchId: batch.id, rowCount: rows.length },
  };
}

/**
 * Worker entry point (Vercel Hobby inline/on-demand + ADR-0004 Postgres job ledger).
 * Dispatches real pipelines for Drive crawl, OOXML extraction, KTP Name Jury,
 * DIT analysis, FR.IA.06 grading, similarity scoring, and FR.AK.05 snapshot export.
 */
export async function runWorkerJob(job: WorkerJobInput): Promise<WorkerJobResult> {
  const started = Date.now();
  logEvent("info", {
    correlation_id: job.id,
    action: `worker.dispatch.${job.type}`,
    resource: "jobs",
    outcome: "started",
  });

  let result: WorkerJobResult;
  switch (job.type) {
    case "hello":
      result = await handleHelloJob(job.id, job.payload);
      break;
    case "drive_scan":
      result = await handleDriveScanJob(job);
      break;
    case "extract_file":
      result = await handleExtractFileJob(job);
      break;
    case "ocr_ktp":
      result = await handleOcrKtpJob(job);
      break;
    case "dit_analysis":
      result = await handleDitAnalysisJob(job);
      break;
    case "written_grading":
      result = await handleWrittenGradingJob(job);
      break;
    case "similarity_run":
      result = await handleSimilarityRunJob(job);
      break;
    case "ak05_export":
      result = await handleAk05ExportJob(job);
      break;
    default:
      throw new Error(`UNSUPPORTED_JOB_TYPE: Tipe pekerjaan '${job.type}' tidak dikenal.`);
  }

  logEvent("info", {
    correlation_id: job.id,
    action: `worker.dispatch.${job.type}`,
    resource: "jobs",
    outcome: "success",
    duration_ms: Date.now() - started,
    meta: result.meta,
  });

  return result;
}
