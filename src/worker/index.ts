import type { RuntimeLlmConfig } from "@/ai/llm";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { decryptSecret } from "@/lib/crypto/encryption";
import { getConfig } from "@/lib/config/get-config";
import { selectDitInputFiles } from "@/lib/forms/dit-inputs";
import { logEvent } from "@/lib/logger";
import { normalizeOcrConfidence } from "@/lib/ocr/confidence";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeExtractedText } from "@/lib/text/sanitize-extracted-text";
import { readStringField } from "@/lib/utils/record-fields";
import { findBestMatchingCandidate } from "@/lib/names";
import {
  getAssesseeById,
  listAssesseesByBatch,
  pruneOrphanedDuplicateAssessees,
  saveNameJuryVerdictAndOcr,
  updateAssesseeDisplayName,
  upsertAssesseesForBatch,
} from "@/repositories/assessees.repository";
import {
  getLatestDitAnalysis,
  getLatestWrittenGrading,
  saveAk05ReportForBatch,
  saveDitAnalysis,
  saveSimilarityPairsForBatch,
  saveWrittenGrading,
} from "@/repositories/assessment.repository";
import { getAssessorProfile } from "@/repositories/auth.repository";
import {
  getBatchById,
  getDriveFileById,
  listDriveFilesForBatch,
  updateBatchMetadata,
  updateDriveFileExtraction,
  upsertDriveFilesForBatch,
  type DriveTriageStatus,
} from "@/repositories/batches.repository";
import { getLatestProviderConfigForAssessor } from "@/repositories/provider.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { getActiveSignature } from "@/repositories/signatures.repository";
import { checkDitCompletenessGate, runDitPipeline } from "@/services/dit";
import { parseSuratTugasText } from "@/services/surat-tugas";
import {
  classifyDocumentTextContent,
  classifyDriveFileName,
  cleanCandidateLabel,
  crawlPublicDriveFolder,
  extractCandidateNamesFromDocumentText,
  extractDriveFolderId,
  extractGoogleSheetId,
  explainNameInference,
  hasTaskOrFolderPrefix,
  inferCandidateFromDrivePath,
  parseKelompokAsesiCsv,
  resolveSchemeFormDocType,
  type ClassifiedDriveFile,
  type SchemeFormClassifierEntry,
} from "@/services/drive";
import {
  compareDriveFileFreshnessDesc,
  pickLatestDriveFile,
} from "@/services/drive-revisions";
import {
  EXTRACTABLE_TEXT_EXT_RE,
  extractTextFromBuffer,
  isOleEncryptedBuffer,
  unpackSafeZipEntries,
} from "@/services/extract";
import { validateMasterKey06bContent } from "@/lib/written/master-key";
import {
  downloadPublicDriveFileBuffer,
  enrichFilesByContent,
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

import type { BatchSummary } from "@/repositories/batches.repository";
import type { SchemeRecord } from "@/repositories/schemes.repository";

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

async function resolveDriveApiKeyIfNeeded(
  userId: string,
  needed: boolean,
  explicitKey?: string,
): Promise<string | undefined> {
  const cleanExplicit = explicitKey?.trim();
  if (cleanExplicit) return cleanExplicit;
  if (!needed) return undefined;
  return resolveOptionalDriveApiKey(userId);
}

async function resolveSchemeForBatch(
  userId: string,
  batch: BatchSummary,
): Promise<SchemeRecord | null> {
  const schemes = await listSchemes(userId, batch.lspId);
  return schemes.find((s) => s.id === batch.schemeId) ?? null;
}

async function loadBatchWithScheme(
  userId: string,
  batchId: string,
): Promise<{ batch: BatchSummary; scheme: SchemeRecord | null }> {
  const batch = await getBatchById(userId, batchId);
  if (!batch) {
    throw new Error(`NOT_FOUND: Batch ${batchId} tidak ditemukan.`);
  }
  const scheme = await resolveSchemeForBatch(userId, batch);
  return { batch, scheme };
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

const MAX_ZIP_ARCHIVES_PER_SCAN = 5;
const MAX_CONTENT_INSPECT_PER_SCAN = 12;

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
const BATCH_MASTER_INSTRUMENT_TYPES = new Set(["04a", "06a", "06b", "09"]);
const BATCH_MASTER_INSTRUMENT_ROLES = new Set([
  "dit",
  "written_soal",
  "written_kunci",
  "interview",
  "mapa",
]);

function buildBatchMasterInstrumentSet(
  schemeForms?: SchemeFormClassifierEntry[],
): Set<string> {
  const result = new Set<string>(BATCH_MASTER_INSTRUMENT_TYPES);
  for (const f of schemeForms ?? []) {
    if (BATCH_MASTER_INSTRUMENT_ROLES.has(f.instrumentRole)) {
      result.add(resolveSchemeFormDocType(f));
      result.add(f.formKey.toLowerCase());
    }
  }
  return result;
}

interface ScanCandidateFile extends ClassifiedDriveFile {
  triageStatus?: DriveTriageStatus;
  archiveEntryPath?: string | null;
  extractedText?: string | null;
  extractionMethod?: string | null;
  triageReason?: string | null;
}

function formatUnextractableZipReason(rawError: string): string {
  if (rawError.includes("ZIP_ENCRYPTED")) {
    return "Tidak dapat diproses (arsip ZIP terenkripsi / dilindungi kata sandi). Tindakan: unduh manual dari Drive, ekstrak dengan kata sandi, lalu unggah berkas isinya ke folder batch atau ubah status ke 'not_needed'.";
  }
  if (rawError.includes("DRIVE_ACCESS_DENIED")) {
    return "Tidak dapat diproses (izin akses Drive terbatas). Tindakan: ubah izin berbagi arsip menjadi 'Anyone with the link' lalu pindai ulang, atau unduh & unggah isi berkas secara manual.";
  }
  if (rawError.includes("ZIP_TOO_LARGE") || rawError.includes("FILE_TOO_LARGE")) {
    return "Tidak dapat diproses (ukuran arsip melebihi batas ekstraksi otomatis 15 MB). Tindakan: ekstrak manual di perangkat Anda lalu unggah berkas isinya ke folder Drive batch.";
  }
  return `Tidak dapat diproses (${rawError}). Tindakan: unduh manual dari Google Drive, ekstrak berkas di perangkat Anda, lalu unggah isi berkasnya ke folder Drive batch atau ubah status ke 'not_needed'.`;
}

async function expandZipArchivesForScan(
  discovered: ClassifiedDriveFile[],
  apiKey: string | undefined,
  schemeForms?: SchemeFormClassifierEntry[],
): Promise<{ items: ScanCandidateFile[]; unpackedZipCount: number }> {
  const output: ScanCandidateFile[] = [];
  let unpackedZipCount = 0;
  const masterTypes = buildBatchMasterInstrumentSet(schemeForms);

  for (const file of discovered) {
    const isZip =
      file.fileName.toLowerCase().endsWith(".zip") ||
      file.mimeType === "application/zip" ||
      file.mimeType === "application/x-zip-compressed";

    if (!isZip || unpackedZipCount >= MAX_ZIP_ARCHIVES_PER_SCAN) {
      output.push(file);
      continue;
    }

    unpackedZipCount++;
    try {
      const zipBuffer = await downloadPublicDriveFileBuffer({
        driveFileId: file.driveFileId,
        apiKey,
      });
      const entries = await unpackSafeZipEntries(zipBuffer);
      const lastSlash = file.drivePath.lastIndexOf("/");
      const zipFolder = lastSlash > 0 ? file.drivePath.slice(0, lastSlash) : "";

      if (entries.length === 0) {
        output.push({
          ...file,
          triageStatus: "unextractable",
          classificationReason:
            "Tidak dapat diproses (arsip ZIP kosong atau tidak memuat format dokumen yang didukung). Tindakan: periksa isi arsip secara manual lalu unggah berkas dokumennya atau ubah status ke 'not_needed'.",
        });
        continue;
      }

      const preclassified = entries.map((entry) => {
        const syntheticPath = zipFolder ? `${zipFolder}/${entry.entryPath}` : entry.entryPath;
        const parentPath = syntheticPath.includes("/")
          ? syntheticPath.slice(0, syntheticPath.lastIndexOf("/"))
          : "";
        return {
          entry,
          syntheticPath,
          parentPath,
          cls: classifyDriveFileName(entry.fileName, parentPath, schemeForms),
        };
      });

      const mukTemplateCount = preclassified.filter(
        (item) => item.cls.docType === "template_muk",
      ).length;
      const isMasterMukArchive = zipFolder === "" && mukTemplateCount >= 3;

      output.push({
        ...file,
        triageStatus: "not_needed",
        classificationReason: isMasterMukArchive
          ? `Arsip MUK master diekstrak menjadi ${entries.length} berkas`
          : `Arsip ZIP diekstrak menjadi ${entries.length} berkas`,
      });

      for (const item of preclassified) {
        const { entry, syntheticPath, parentPath } = item;
        let cls = item.cls;
        let extractedText: string | null = null;
        let extractionMethod: string | null = null;
        let isOleEncryptedEntry = false;

        const shouldExtractEntryText =
          EXTRACTABLE_TEXT_EXT_RE.test(entry.fileName) &&
          cls.docType !== "materi_pelatihan" &&
          cls.docType !== "template_muk";

        if (shouldExtractEntryText) {
          if (entry.fileName.toLowerCase().endsWith(".docx") && isOleEncryptedBuffer(entry.buffer)) {
            isOleEncryptedEntry = true;
          } else {
            try {
              const parsed = await extractTextFromBuffer({
                buffer: entry.buffer,
                fileName: entry.fileName,
                mimeType: entry.mimeType,
              });
              if (parsed.text.trim()) {
                extractedText = parsed.text.trim();
                extractionMethod = parsed.extractionMethod;
                const byText = classifyDocumentTextContent(
                  extractedText,
                  entry.fileName,
                  parentPath,
                  schemeForms,
                );
                if (byText && cls.docType === "unknown") {
                  cls = byText;
                }
              }
            } catch {
              // Keep filename-based classification when ZIP member is encrypted/image PDF
            }
          }
        }

        const entryStatus: DriveTriageStatus | undefined =
          cls.docType === "materi_pelatihan" || cls.docType === "template_muk"
            ? "not_needed"
            : isMasterMukArchive
              ? "not_needed"
              : undefined;

        let entryReason = cls.reason;
        if (isMasterMukArchive && cls.docType !== "template_muk") {
          if (cls.docType === "06b") {
            if (isOleEncryptedEntry) {
              entryReason = `Blanko/template 06B terenkripsi dari arsip MUK ${file.fileName} — tidak diaktifkan otomatis sebagai kunci master`;
            } else if (!validateMasterKey06bContent(extractedText).valid) {
              entryReason = `Blanko/template 06B (belum berisi jawaban kunci) dari arsip MUK ${file.fileName} — tidak diaktifkan otomatis sebagai kunci master`;
            } else {
              entryReason = `Kandidat 06B dari arsip MUK ${file.fileName} — tidak diaktifkan otomatis tanpa verifikasi asesor`;
            }
          } else {
            entryReason = masterTypes.has(cls.docType)
              ? `Instrumen master batch (${cls.docType}) dari arsip MUK ${file.fileName}`
              : `Blanko template (${cls.docType}) dari arsip MUK master ${file.fileName}`;
          }
        }

        output.push({
          driveFileId: `${file.driveFileId}::${entry.entryPath}`,
          fileName: entry.fileName,
          mimeType: entry.mimeType,
          drivePath: syntheticPath,
          docType: cls.docType,
          confidence: cls.confidence,
          classificationReason: entryReason,
          triageStatus: entryStatus,
          modifiedTime: entry.modifiedTimeIso ?? file.modifiedTime ?? null,
          archiveEntryPath: entry.entryPath,
          extractedText,
          extractionMethod,
        });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "ZIP tidak dapat dibuka";
      output.push({
        ...file,
        triageStatus: "unextractable",
        classificationReason: formatUnextractableZipReason(reason),
      });
    }
  }

  return { items: output, unpackedZipCount };
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
  const scheme = await resolveSchemeForBatch(userId, batch);
  const schemeForms = scheme?.forms;
  const masterTypes = buildBatchMasterInstrumentSet(schemeForms);

  if (Array.isArray(job.payload.files)) {
    const classified = job.payload.files
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item, idx) => {
        const fileName = String(item.fileName ?? `file-${idx + 1}`);
        const drivePath = String(item.drivePath ?? fileName);
        const cls = classifyDriveFileName(fileName, drivePath, schemeForms);
        return {
          driveFileId: String(item.driveFileId ?? `manual-${idx + 1}`),
          fileName,
          mimeType: String(item.mimeType ?? "application/octet-stream"),
          drivePath,
          docType: typeof item.docType === "string" ? item.docType : cls.docType,
          confidence:
            typeof item.confidence === "number" ? item.confidence : cls.confidence,
          triageReason: cls.reason,
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
    typeof job.payload.apiKey === "string" ? job.payload.apiKey : undefined;
  const driveApiKey =
    (await resolveDriveApiKeyIfNeeded(userId, true, payloadApiKey)) ?? "";

  const [discovered, existingFiles, existingAssesseesBefore] = await Promise.all([
    crawlPublicDriveFolder({
      folderId,
      apiKey: driveApiKey || undefined,
      schemeForms,
    }),
    listDriveFilesForBatch(userId, batch.id),
    listAssesseesByBatch(userId, batch.id),
  ]);

  const existingByDriveId = new Map(existingFiles.map((f) => [f.driveFileId, f]));

  const { items: expandedFiles } = await expandZipArchivesForScan(
    discovered,
    driveApiKey || undefined,
    schemeForms,
  );

  await enrichFilesByContent({
    files: expandedFiles,
    apiKey: driveApiKey || undefined,
    maxInspect: MAX_CONTENT_INSPECT_PER_SCAN,
    persistUpdates: false,
    reassignAssessee: false,
    schemeForms,
    cachedTextLookup: (file) => existingByDriveId.get(file.driveFileId)?.extractedText,
  });

  const suratTugasRoster: string[] = [];
  let parsedSuratTugasDate: string | null = null;
  let parsedSuratTugasTuk: string | null = null;
  const inferredPerFile = expandedFiles.map((file) => {
    const inferred = inferCandidateFromDrivePath(file.drivePath, file.fileName);
    let candidateName = inferred.candidateName;
    let isAuthoritativeRoster = inferred.isAuthoritativeRoster;

    if (file.extractedText) {
      if (file.docType === "surat_tugas") {
        const stParsed = parseSuratTugasText(file.extractedText);
        if (!parsedSuratTugasDate && stParsed.assessmentDate) {
          parsedSuratTugasDate = stParsed.assessmentDate;
        }
        if (!parsedSuratTugasTuk && stParsed.tukName) {
          parsedSuratTugasTuk = stParsed.tukName;
        }
        const names =
          stParsed.candidateNames.length > 0
            ? stParsed.candidateNames
            : extractCandidateNamesFromDocumentText("surat_tugas", file.extractedText);
        suratTugasRoster.push(...names);
      } else if (!candidateName && file.docType === "apl01") {
        const extractedNames = extractCandidateNamesFromDocumentText(
          "apl01",
          file.extractedText,
        );
        const extractedName = extractedNames[0];
        if (extractedName) {
          candidateName = extractedName;
          isAuthoritativeRoster = true;
        } else {
          logEvent("warn", {
            correlation_id: job.id,
            user_id: userId,
            action: "drive_scan.apl01_name_not_found",
            resource: "drive_files",
            outcome: "denied",
            meta: {
              batchId,
              driveFileId: file.driveFileId,
              fileName: file.fileName,
              drivePath: file.drivePath,
              docType: file.docType,
              reason: "APL.01 teks terdieksi tetapi pola nama tidak cocok — lihat triage untuk alasan",
            },
          });
        }
      }
    }

    return { file, candidateName, isAuthoritativeRoster };
  });

  const authoritativeNames = Array.from(
    new Set([
      ...inferredPerFile
        .filter((x) => x.isAuthoritativeRoster && x.candidateName && x.candidateName.length > 1)
        .map((x) => x.candidateName as string),
      ...suratTugasRoster,
    ]),
  );
  const nonAuthNames = Array.from(
    new Set(
      inferredPerFile
        .filter((x) => !x.isAuthoritativeRoster && x.candidateName && x.candidateName.length > 1)
        .map((x) => x.candidateName as string),
    ),
  );

  let upsertedRecords = existingAssesseesBefore;
  const canonicalIds = new Set<string>();
  const staleDuplicateIds = new Set<string>();
  const staleDuplicateMerges = new Map<
    string,
    { fromId: string; fromName: string; toId: string; toName: string }
  >();
  const renamedAssessees: Array<{
    assesseeId: string;
    fromName: string;
    toName: string;
    reason: string;
  }> = [];

  if (authoritativeNames.length > 0) {
    const authUpserted = await upsertAssesseesForBatch({
      userId,
      lspId: batch.lspId,
      batchId: batch.id,
      names: authoritativeNames,
      existingPool: existingAssesseesBefore,
    });
    upsertedRecords = authUpserted;

    const canonicalTargets: Array<{ id: string; displayName: string }> = [];
    for (const authName of authoritativeNames) {
      const m = findBestMatchingCandidate(authName, authUpserted);
      if (m) {
        if (
          !m.certificateNameConfirmed &&
          hasTaskOrFolderPrefix(m.displayName) &&
          !hasTaskOrFolderPrefix(authName) &&
          m.displayName !== authName
        ) {
          const previousName = m.displayName;
          await updateAssesseeDisplayName({
            userId,
            assesseeId: m.id,
            displayName: authName,
          });
          m.displayName = authName;
          renamedAssessees.push({
            assesseeId: m.id,
            fromName: previousName,
            toName: authName,
            reason: "prefix_folder_tugas_dibersihkan",
          });
        }
        canonicalIds.add(m.id);
        canonicalTargets.push(m);
      }
    }

    const canonicalMatchCache = new Map<
      string,
      { id: string; displayName: string } | null
    >();
    const matchCanonical = (label: string) => {
      if (canonicalMatchCache.has(label)) {
        return canonicalMatchCache.get(label) ?? undefined;
      }
      const matched = findBestMatchingCandidate(label, canonicalTargets) ?? null;
      canonicalMatchCache.set(label, matched);
      return matched ?? undefined;
    };

    for (const existing of existingAssesseesBefore) {
      if (canonicalIds.has(existing.id) || existing.certificateNameConfirmed) continue;
      const cleanedExisting = cleanCandidateLabel(existing.displayName);
      const canonicalTarget = matchCanonical(cleanedExisting || existing.displayName);
      if (canonicalTarget) {
        staleDuplicateIds.add(existing.id);
        staleDuplicateMerges.set(existing.id, {
          fromId: existing.id,
          fromName: existing.displayName,
          toId: canonicalTarget.id,
          toName: canonicalTarget.displayName,
        });
      }
    }
    // When an authoritative roster exists (Persyaratan / Surat Tugas / APL.01),
    // never auto-create new assessee rows from non-authoritative task folders/filenames;
    // unmatched files stay in Triage (`unmatched`) for assessor review.
  } else {
    const fallbackNames = Array.from(
      new Set(nonAuthNames.filter((name) => !hasTaskOrFolderPrefix(name))),
    );
    if (fallbackNames.length > 0) {
      upsertedRecords = await upsertAssesseesForBatch({
        userId,
        lspId: batch.lspId,
        batchId: batch.id,
        names: fallbackNames,
        existingPool: existingAssesseesBefore,
      });
    }
  }

  // Connect Sheet Kelompok Asesi import: read kelompokSheetUrl from batch,
  // fetch CSV export, parse, and upsert any names not already in the roster.
  if (batch.kelompokSheetUrl) {
    try {
      const sheetId = extractGoogleSheetId(batch.kelompokSheetUrl);
      if (sheetId) {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        const sheetRes = await fetch(csvUrl, {
          headers: {
            "User-Agent": "AsesorKompetensi/1.4 (+https://assessor-zeta.vercel.app)",
          },
          signal: AbortSignal.timeout(30000),
        });
        if (sheetRes.ok) {
          const csvText = await sheetRes.text();
          const sheetGroups = parseKelompokAsesiCsv(csvText);
          const sheetNames: string[] = sheetGroups.flatMap((g: { assesseeNames: string[] }) => g.assesseeNames);
          const currentPool = upsertedRecords.length > 0 ? upsertedRecords : existingAssesseesBefore;
          const newSheetNames = sheetNames.filter(
            (name: string) =>
              !currentPool.some(
                (a) => normalizeName(a.displayName).toLowerCase() === normalizeName(name).toLowerCase(),
              ),
          );
          if (newSheetNames.length > 0) {
            upsertedRecords = await upsertAssesseesForBatch({
              userId,
              lspId: batch.lspId,
              batchId: batch.id,
              names: newSheetNames,
              existingPool: currentPool,
            });
            try {
              const supabase = await getSupabaseServerClient();
              await writeAuditLog(
                {
                  lsp_id: batch.lspId,
                  actor_id: userId,
                  action: "batch.roster.import",
                  resource: "batches",
                  resource_id: batch.id,
                  after_summary: {
                    batchId: batch.id,
                    jobId: job.id,
                    source: "kelompok_sheet_url",
                    sheetId,
                    importedCount: newSheetNames.length,
                    totalNames: sheetNames.length,
                    groups: sheetGroups.map((g: { groupName: string; assesseeNames: string[] }) => ({
                      group: g.groupName,
                      count: g.assesseeNames.length,
                    })),
                  },
                },
                supabase,
              );
            } catch {
              // Non-fatal outside Next.js request scope.
            }
          }
        }
      }
    } catch {
      // Sheet import is best-effort; scan must not fail because of it.
    }
  }

  const assesseePool = upsertedRecords.length > 0 ? upsertedRecords : existingAssesseesBefore;
  const matchTargets = assesseePool.filter((a) => !staleDuplicateIds.has(a.id));
  const poolMatchCache = new Map<string, (typeof matchTargets)[number] | null>();

  const enrichedFiles = inferredPerFile.map(({ file, candidateName }) => {
    const existing = existingByDriveId.get(file.driveFileId);
    let matched: (typeof matchTargets)[number] | undefined;
    if (candidateName) {
      if (poolMatchCache.has(candidateName)) {
        matched = poolMatchCache.get(candidateName) ?? undefined;
      } else {
        matched = findBestMatchingCandidate(candidateName, matchTargets);
        poolMatchCache.set(candidateName, matched ?? null);
      }
    }

    if (file.triageStatus === "unextractable") {
      return {
        driveFileId: file.driveFileId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        drivePath: file.drivePath,
        docType: file.docType,
        confidence: file.confidence,
        assesseeId: matched?.id ?? null,
        triageStatus: "unextractable" as const,
        triageReason:
          file.classificationReason ??
          "Tidak dapat diproses otomatis — unduh dan unggah berkas secara manual.",
        driveModifiedTime: file.modifiedTime ?? null,
        archiveEntryPath: file.archiveEntryPath ?? null,
      };
    }

    const isNonAssesseeDoc =
      file.docType === "materi_pelatihan" ||
      file.docType === "template_muk" ||
      file.triageStatus === "not_needed";

    if (matched) {
      return {
        driveFileId: file.driveFileId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        drivePath: file.drivePath,
        docType: file.docType,
        confidence: file.confidence,
        assesseeId: matched.id,
        triageStatus: isNonAssesseeDoc ? ("not_needed" as const) : ("assigned" as const),
        triageReason:
          file.classificationReason ?? `Cocok ke ${matched.displayName}`,
        driveModifiedTime: file.modifiedTime ?? null,
        archiveEntryPath: file.archiveEntryPath ?? null,
        ...(file.extractedText ? { extractedText: file.extractedText } : {}),
        ...(file.extractionMethod ? { extractionMethod: file.extractionMethod } : {}),
      };
    }

    const keepManualAssessee =
      existing?.assesseeId &&
      existing.triageStatus === "assigned" &&
      !staleDuplicateIds.has(existing.assesseeId)
        ? existing.assesseeId
        : null;

    const isBatchMasterInstrument =
      !keepManualAssessee && masterTypes.has(file.docType);

    const status: DriveTriageStatus =
      isNonAssesseeDoc || isBatchMasterInstrument
        ? "not_needed"
        : keepManualAssessee
          ? "assigned"
          : "unmatched";

    return {
      driveFileId: file.driveFileId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      drivePath: file.drivePath,
      docType: file.docType,
      confidence: file.confidence,
      assesseeId: keepManualAssessee,
      triageStatus: status,
      triageReason: isBatchMasterInstrument
        ? (file.classificationReason ??
            `Instrumen master tingkat batch (${file.docType}) — tidak perlu dipetakan ke asesi`)
        : candidateName
          ? `Kandidat "${candidateName}" belum cocok dengan peserta otoritatif — petakan manual di Triage (${file.classificationReason ?? file.docType})`
          : explainNameInference(file.drivePath) ??
              (file.classificationReason ?? "Berkas belum dipetakan ke asesi"),
      driveModifiedTime: file.modifiedTime ?? null,
      archiveEntryPath: file.archiveEntryPath ?? null,
      ...(file.extractedText ? { extractedText: file.extractedText } : {}),
      ...(file.extractionMethod ? { extractionMethod: file.extractionMethod } : {}),
    };
  });

  const savedCount = await upsertDriveFilesForBatch({
    userId,
    lspId: batch.lspId,
    batchId: batch.id,
    files: enrichedFiles,
  });

  if (
    (!batch.assessmentDate && parsedSuratTugasDate) ||
    (!batch.tukName && parsedSuratTugasTuk)
  ) {
    await updateBatchMetadata({
      userId,
      batchId: batch.id,
      ...(!batch.assessmentDate && parsedSuratTugasDate
        ? { assessmentDate: parsedSuratTugasDate }
        : {}),
      ...(!batch.tukName && parsedSuratTugasTuk
        ? { tukName: parsedSuratTugasTuk }
        : {}),
    });
  }

  const prunedRows = await pruneOrphanedDuplicateAssessees({
    userId,
    batchId: batch.id,
  });

  const mergedAssessees = prunedRows.map((row) => {
    const entry = typeof row === "string" ? { id: row, displayName: row } : row;
    const mergeInfo = staleDuplicateMerges.get(entry.id);
    return {
      fromId: entry.id,
      fromName: mergeInfo?.fromName ?? entry.displayName,
      toId: mergeInfo?.toId ?? null,
      toName: mergeInfo?.toName ?? null,
      reason: mergeInfo
        ? "duplikat_digabung_ke_kanonikal"
        : "entri_kosong_dibersihkan",
    };
  });

  const summaryParts: string[] = [];
  if (mergedAssessees.length > 0) {
    const mergeLabel = mergedAssessees
      .map((m) => (m.toName ? `${m.fromName} → ${m.toName}` : m.fromName))
      .join(", ");
    summaryParts.push(`Digabung (${mergedAssessees.length}): ${mergeLabel}`);
  }
  if (renamedAssessees.length > 0) {
    const renameLabel = renamedAssessees
      .map((r) => `${r.fromName} → ${r.toName}`)
      .join(", ");
    summaryParts.push(`Dibersihkan (${renamedAssessees.length}): ${renameLabel}`);
  }
  const rosterChangeSummary = summaryParts.join(" · ");

  if (mergedAssessees.length > 0 || renamedAssessees.length > 0) {
    try {
      const supabase = await getSupabaseServerClient();
      await writeAuditLog(
        {
          lsp_id: batch.lspId,
          actor_id: userId,
          action: "batch.roster.reconciled",
          resource: "batches",
          resource_id: batch.id,
          correlation_id: job.id,
          after_summary: {
            batchId: batch.id,
            jobId: job.id,
            beforeCount: existingAssesseesBefore.length,
            afterCount: Math.max(0, matchTargets.length),
            mergedAssessees,
            renamedAssessees,
            rosterChangeSummary,
          },
        },
        supabase,
      );
    } catch {
      // Non-fatal outside Next.js request scope (e.g. unit tests)
    }
  }

  const unextractableFiles = enrichedFiles.filter(
    (f) => f.triageStatus === "unextractable",
  ).length;

  return {
    status: "done",
    progress: 100,
    meta: {
      scannedFiles: savedCount,
      discoveredAssessees: Math.max(0, matchTargets.length),
      prunedDuplicateAssessees: mergedAssessees.length,
      ...(renamedAssessees.length > 0 ? { renamedAssesseesCount: renamedAssessees.length } : {}),
      ...(unextractableFiles > 0 ? { unextractableFiles } : {}),
      ...(mergedAssessees.length > 0 ? { mergedAssessees } : {}),
      ...(renamedAssessees.length > 0 ? { renamedAssessees } : {}),
      ...(rosterChangeSummary ? { rosterChangeSummary } : {}),
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
    const existingRecord = await getDriveFileById(userId, fileId);
    const driveApiKey = await resolveDriveApiKeyIfNeeded(
      userId,
      !existingRecord?.extractedText?.trim(),
    );
    const targetFile = existingRecord ?? {
      id: fileId,
      driveFileId,
      fileName: fileName || "document.docx",
      mimeType,
      extractedText: null,
      extractionMethod: null,
    };

    const outcome = await ensureDriveFileExtracted({
      userId,
      file: targetFile,
      apiKey: driveApiKey,
    });
    extractedText = outcome.text ?? "";
    extractionMethod = outcome.extractionMethod ?? "drive_extract";

    if (!extractedText) {
      throw new Error(
        outcome.error
          ? `UNPROCESSABLE: ${outcome.error}`
          : "UNPROCESSABLE: Tidak ada teks yang dapat diekstrak dari berkas.",
      );
    }

    return {
      status: "done",
      progress: 100,
      meta: { fileId, extractionMethod, chars: extractedText.length },
    };
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
  const ocrConfidence = normalizeOcrConfidence(
    typeof job.payload.ocrConfidence === "number" ? job.payload.ocrConfidence : 0.9,
  );
  const ocrConfidenceFloor = normalizeOcrConfidence(
    typeof job.payload.ocrConfidenceFloor === "number"
      ? job.payload.ocrConfidenceFloor
      : 0.75,
  );

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

  const { batch, scheme } = await loadBatchWithScheme(userId, assessee.batchId);
  const files = await listDriveFilesForBatch(userId, batch.id);
  const assesseeFiles = files.filter((f) => f.assesseeId === assessee.id);

  const clean04a = sanitizeExtractedText(
    typeof job.payload.frIa04aText === "string" ? job.payload.frIa04aText : "",
  ).trim();
  const clean04b = sanitizeExtractedText(
    typeof job.payload.presentationTranscript === "string"
      ? job.payload.presentationTranscript
      : "",
  ).trim();
  const cleanCv = sanitizeExtractedText(
    typeof job.payload.candidateProfileSummary === "string"
      ? job.payload.candidateProfileSummary
      : "",
  ).trim();

  // Round 22 T6 (P1-6): persist manual pasted overrides as `manual_paste` so
  // reload shows "Siap (manual)" and future runs skip re-extracting broken Drive files.
  if (clean04a || clean04b || cleanCv) {
    const selectedDit = selectDitInputFiles(assesseeFiles, files);
    const nowIso = new Date().toISOString();
    const manualUpserts: Array<{
      driveFileId: string;
      fileName: string;
      mimeType: string;
      drivePath: string;
      docType: string;
      confidence: number;
      assesseeId: string;
      triageStatus: "assigned";
      triageReason: string;
      extractedText: string;
      extractionMethod: string;
      driveModifiedTime: string;
    }> = [];

    const persistManualTarget = async (
      existingFile: (typeof files)[number] | null | undefined,
      text: string,
      fallback: { driveFileId: string; fileName: string; drivePath: string; docType: string; reason: string },
    ) => {
      if (!text) return;
      if (existingFile?.id) {
        await updateDriveFileExtraction({
          userId,
          fileId: existingFile.id,
          extractedText: text,
          extractionMethod: "manual_paste",
        });
      } else {
        manualUpserts.push({
          driveFileId: fallback.driveFileId,
          fileName: fallback.fileName,
          mimeType: "text/plain",
          drivePath: fallback.drivePath,
          docType: fallback.docType,
          confidence: 1,
          assesseeId: assessee.id,
          triageStatus: "assigned",
          triageReason: fallback.reason,
          extractedText: text,
          extractionMethod: "manual_paste",
          driveModifiedTime: nowIso,
        });
      }
    };

    try {
      await persistManualTarget(selectedDit.usedCvFile, cleanCv, {
        driveFileId: `manual-dit-cv-${assessee.id}`,
        fileName: "CV_Manual.txt",
        drivePath: "Manual Input/CV_Manual.txt",
        docType: "cv",
        reason: "Teks CV ditempel manual oleh asesor",
      });
      await persistManualTarget(selectedDit.assessee04a[0], clean04a, {
        driveFileId: `manual-dit-04a-${assessee.id}`,
        fileName: "FR.IA.04A_Manual.txt",
        drivePath: "Manual Input/FR.IA.04A_Manual.txt",
        docType: "04a",
        reason: "Teks FR.IA.04A ditempel manual oleh asesor",
      });
      await persistManualTarget(
        selectedDit.combinedDitFiles.length === 1 ? selectedDit.combinedDitFiles[0] : null,
        clean04b,
        {
          driveFileId: `manual-dit-04b-${assessee.id}`,
          fileName: "Tugas_DIT_Manual.txt",
          drivePath: "Manual Input/Tugas_DIT_Manual.txt",
          docType: "04b",
          reason: "Teks Tugas DIT ditempel manual oleh asesor",
        },
      );
      if (manualUpserts.length > 0) {
        await upsertDriveFilesForBatch({
          userId,
          lspId: assessee.lspId,
          batchId: batch.id,
          files: manualUpserts,
        });
      }
    } catch (err) {
      logEvent("warn", {
        correlation_id: job.id,
        user_id: userId,
        tenant_id: assessee.lspId,
        action: "dit.manual_override.persist",
        resource: "drive_files",
        outcome: "failure",
        meta: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  const needsInputs = !clean04a || !clean04b || !cleanCv;
  const driveApiKey = await resolveDriveApiKeyIfNeeded(userId, needsInputs);
  const resolvedInputs = needsInputs
    ? await resolveAssesseeDitInputs({
        userId,
        files: assesseeFiles,
        batchFiles: files,
        scheme,
        apiKey: driveApiKey,
        skip04a: Boolean(clean04a),
        skip04b: Boolean(clean04b),
        skipCv: Boolean(cleanCv),
      })
    : null;

  const frIa04aText = clean04a || resolvedInputs?.frIa04aText || "";
  const presentationTranscript = clean04b || resolvedInputs?.presentationTranscript || "";
  const candidateProfileSummary = cleanCv || resolvedInputs?.candidateProfileSummary || "";

  const earlyGate = checkDitCompletenessGate({
    frIa04aText,
    presentationTranscript,
    candidateProfileSummary,
  });
  if (!earlyGate.passed) {
    const missingLabels = earlyGate.missing.map((m) => m.label).join(", ");
    const errList = resolvedInputs?.extractionErrors ?? [];
    const extractionSuffix = errList.length > 0 ? ` (${errList.join("; ")})` : "";
    throw new Error(
      `UNPROCESSABLE: Bahan DIT belum lengkap setelah ekstraksi (${missingLabels})${extractionSuffix}`,
    );
  }

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
    if (result.reason === "incomplete_inputs" && "missing" in result) {
      const missingLabels = result.missing.map((m) => m.label).join(", ");
      const errList = resolvedInputs?.extractionErrors ?? [];
      const extractionSuffix = errList.length > 0 ? ` (${errList.join("; ")})` : "";
      throw new Error(
        `UNPROCESSABLE: Bahan DIT belum lengkap setelah ekstraksi (${missingLabels})${extractionSuffix}`,
      );
    }
    throw new Error(
      "error" in result && result.error ? result.error : `DIT_FAILED: ${result.reason}`,
    );
  }

  const previousDit = await getLatestDitAnalysis(userId, assessee.id);
  const prevOfficial04b =
    previousDit &&
    typeof (previousDit.official04b ?? previousDit.official_04b) === "object" &&
    (previousDit.official04b ?? previousDit.official_04b) !== null
      ? ((previousDit.official04b ?? previousDit.official_04b) as Record<string, unknown>)
      : {};

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
      ...prevOfficial04b,
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

  const { batch, scheme } = await loadBatchWithScheme(userId, assessee.batchId);
  const configuredMapping = await getConfig("form_mapping.06", { lspId: assessee.lspId });
  const mapping = scheme?.manifest?.formSuffixMapping ??
    configuredMapping ?? {
      soal: "06A",
      kunci: "06B",
      jawaban: "06C",
    };

  const files = await listDriveFilesForBatch(userId, batch.id);
  const kunciDocTypeLower = mapping.kunci.toLowerCase();
  const relevantDocTypes = new Set([
    mapping.soal.toLowerCase(),
    kunciDocTypeLower,
    mapping.jawaban.toLowerCase(),
  ]);
  const candidateFiles = files
    .filter((f) => {
      const dtLower = f.docType.toLowerCase();
      if (!relevantDocTypes.has(dtLower)) return false;
      if (f.assesseeId && f.assesseeId !== assessee.id) return false;
      if (dtLower === kunciDocTypeLower) {
        return (
          Boolean(batch.activeMasterKeyFileId) &&
          f.id === batch.activeMasterKeyFileId &&
          batch.activeMasterKeyValidationStatus === "valid"
        );
      }
      return true;
    })
    .sort(compareDriveFileFreshnessDesc);
  const needsDriveExtraction =
    (!job.payload.masterKeyText || !job.payload.studentAnswerText) &&
    candidateFiles.some((f) => !f.extractedText);
  const driveApiKey = await resolveDriveApiKeyIfNeeded(userId, needsDriveExtraction);

  const byDocType: Record<string, string> = {};
  for (const f of candidateFiles) {
    const upperKey = f.docType.toUpperCase();
    // candidateFiles is sorted newest-first; keep newest extractable revision per docType
    if (byDocType[upperKey]) continue;
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
    byDocType[upperKey] = text;
    byDocType[f.docType.toLowerCase()] = text;
  }

  const resolved = resolveWrittenTestFiles(byDocType, mapping);
  const masterKeyText = String(job.payload.masterKeyText ?? resolved.kunciText);
  const studentAnswerText = String(job.payload.studentAnswerText ?? resolved.jawabanText);

  const keyValidation = validateMasterKey06bContent(masterKeyText);
  if (!keyValidation.valid) {
    throw new Error(
      `INVALID_MASTER_KEY_06B: ${keyValidation.summary} Aktifkan kunci 06B kerja yang valid di halaman Detail Batch terlebih dahulu.`,
    );
  }

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

  const previousWritten = await getLatestWrittenGrading(userId, assessee.id);
  const prevFormMapping =
    previousWritten &&
    typeof (previousWritten.formMapping ?? previousWritten.form_mapping) === "object" &&
    (previousWritten.formMapping ?? previousWritten.form_mapping) !== null
      ? ((previousWritten.formMapping ?? previousWritten.form_mapping) as Record<
          string,
          unknown
        >)
      : null;
  const prevOfficial06c =
    prevFormMapping &&
    typeof prevFormMapping.official06c === "object" &&
    prevFormMapping.official06c !== null
      ? (prevFormMapping.official06c as Record<string, unknown>)
      : null;
  const prevConfirmedBy =
    previousWritten &&
    typeof (previousWritten.confirmedBy ?? previousWritten.confirmed_by) === "string"
      ? ((previousWritten.confirmedBy ?? previousWritten.confirmed_by) as string)
      : null;
  const prevConfirmedAt =
    previousWritten
      ? ((previousWritten.confirmedAt ?? previousWritten.confirmed_at) as
          | Date
          | string
          | null
          | undefined) ?? null
      : null;

  await saveWrittenGrading({
    userId,
    lspId: assessee.lspId,
    batchId: batch.id,
    assesseeId: assessee.id,
    formMapping: prevOfficial06c ? { ...mapping, official06c: prevOfficial06c } : mapping,
    itemVerdicts: graded.output.itemVerdicts,
    errorSummary: graded.output.ringkasanKesalahan,
    vatmUnitRecommendations: graded.output.vatmUnitRecommendations,
    plagiarismReport: graded.output.plagiarismReport,
    model: `${llmConfig.provider}/${llmConfig.model}`,
    promptVersion: graded.promptVersion,
    ...(prevOfficial06c && prevConfirmedBy ? { confirmedBy: prevConfirmedBy } : {}),
    ...(prevOfficial06c && prevConfirmedAt ? { confirmedAt: prevConfirmedAt } : {}),
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
    schemeId: batch.schemeId ?? undefined,
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
    const selectedByAssessee = assessees.map((a) => ({
      assesseeId: a.id,
      targetFile: pickLatestDriveFile(
        files.filter(
          (f) => f.assesseeId === a.id && f.docType.toLowerCase() === answerDocType,
        ),
      ),
    }));
    const needsExtraction = selectedByAssessee.some(
      (x) => x.targetFile && !x.targetFile.extractedText?.trim(),
    );
    const driveApiKey = await resolveDriveApiKeyIfNeeded(userId, needsExtraction);
    const resolved: Array<{ assesseeId: string; text: string }> = [];
    const CHUNK = 5;
    for (let i = 0; i < selectedByAssessee.length; i += CHUNK) {
      const slice = selectedByAssessee.slice(i, i + CHUNK);
      const batchTexts = await Promise.all(
        slice.map(async ({ assesseeId, targetFile }) => {
          if (!targetFile) return { assesseeId, text: "" };
          const outcome = await ensureDriveFileExtracted({
            userId,
            file: targetFile,
            apiKey: driveApiKey,
          });
          return { assesseeId, text: outcome.text ?? "" };
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

  const [profile, scheme] = await Promise.all([
    getAssessorProfile(userId),
    resolveSchemeForBatch(userId, batch),
  ]);
  const totalSchemeUnits = resolveUnitsForScheme(scheme).length;
  const rows = await resolveAk05BatchRows(userId, batchId, assessees, {
    totalSchemeUnits,
  });

  await saveAk05ReportForBatch({
    userId,
    lspId: batch.lspId,
    batchId: batch.id,
    assessorId: userId,
    assessorRegNo:
      readStringField(profile as Record<string, unknown> | null | undefined, "regNoMet", "reg_no_met") ||
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
