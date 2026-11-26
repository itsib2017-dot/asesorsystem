"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runInterviewPipeline } from "@/services/interview";
import { decryptSecret } from "@/lib/crypto/encryption";
import { getLspNameForUser } from "@/repositories/auth.repository";
import { resolveSchemeInterviewQuestions } from "@/lib/forms/assessee-forms";
import { resolveUnitsForScheme } from "@/lib/forms/sync-vatm-decisions";
import { getLatestProviderConfigForAssessor } from "@/repositories/provider.repository";
import {
  getBatchById,
  listDriveFilesForBatch,
  upsertDriveFilesForBatch,
} from "@/repositories/batches.repository";
import { isUuid } from "@/db";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { resolveAuthorizedLsp } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { syncAssesseeVatmRecommendations } from "@/lib/forms/sync-vatm-decisions";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { redactPii } from "@/ai/redact";
import { getAssesseeById } from "@/repositories/assessees.repository";
import {
  getLatestDitAnalysis,
  saveInterviewAssessment,
  upsertUnitDecision,
} from "@/repositories/assessment.repository";
import { listSchemes } from "@/repositories/schemes.repository";

const questionSchema = z.object({
  no: z.number().int().min(1),
  question: z.string().min(1).max(2000),
  answerSummary: z.string().max(4000).default(""),
  achieved: z.enum(["Ya", "Tidak"]).nullable().default(null),
  unitCode: z.string().max(64).optional(),
  dimension: z.enum(["TS", "TMS", "CMS", "JRES", "TrS"]).optional(),
});

const NAME_TITLE_STOPWORDS = new Set([
  "binti",
  "bin",
  "skm",
  "s.km",
  "st",
  "mt",
  "mm",
  "dr",
  "ir",
  "hj",
  "drs",
  "spd",
  "mba",
  "kes",
  "msi",
  "se",
  "sh",
  "amd",
]);

function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scrubCandidateIdentityText(
  text: string,
  candidateNames: Array<string | null | undefined>,
  pseudonym: string,
): string {
  if (!text.trim()) return "";
  let cleaned = text;
  const fullNames = Array.from(
    new Set(
      candidateNames
        .map((n) => n?.trim() ?? "")
        .filter((n) => n.length >= 3),
    ),
  ).sort((a, b) => b.length - a.length);

  for (const name of fullNames) {
    cleaned = cleaned.replace(new RegExp(escapeRegex(name), "gi"), pseudonym);
  }

  const tokens = Array.from(
    new Set(
      fullNames
        .flatMap((n) => n.split(/[\s,./()]+/))
        .map((t) => t.trim())
        .filter(
          (t) =>
            t.length >= 4 &&
            !NAME_TITLE_STOPWORDS.has(t.toLowerCase()),
        ),
    ),
  ).sort((a, b) => b.length - a.length);

  for (const token of tokens) {
    cleaned = cleaned.replace(
      new RegExp(`\\b${escapeRegex(token)}\\b`, "gi"),
      pseudonym,
    );
  }

  return redactPii(cleaned);
}

const unitRecSchema = z.object({
  unitCode: z.string().min(1).max(64),
  unitTitle: z.string().min(1).max(500),
  recommendation: z.enum(["K", "BK"]),
  reasoning: z.string().max(2000).default(""),
});

const saveInterviewSchema = z.object({
  batchId: z.string().uuid(),
  assesseeId: z.string().uuid(),
  sourceFileId: z.string().uuid().optional().nullable(),
  overallRecommendation: z.enum(["K", "BK"]),
  assessorNotes: z.string().max(4000).default(""),
  applyToUnitDecisions: z.boolean().default(false),
  questions: z.array(questionSchema).min(1),
  vatmUnitRecommendations: z.array(unitRecSchema).min(1),
});

export async function saveInterviewAssessmentAction(formData: FormData): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  let parsedQuestions: unknown = [];
  let parsedUnits: unknown = [];
  try {
    parsedQuestions = JSON.parse(String(formData.get("questionsJson") ?? "[]"));
    parsedUnits = JSON.parse(String(formData.get("unitsJson") ?? "[]"));
  } catch {
    return { ok: false, error: "Format JSON pertanyaan atau unit wawancara tidak valid." };
  }

  const rawSourceFileId = String(formData.get("sourceFileId") ?? "").trim();
  const parsed = saveInterviewSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    assesseeId: String(formData.get("assesseeId") ?? "").trim(),
    sourceFileId: rawSourceFileId && isUuid(rawSourceFileId) ? rawSourceFileId : null,
    overallRecommendation: String(formData.get("overallRecommendation") ?? "K").trim(),
    assessorNotes: String(formData.get("assessorNotes") ?? "").trim(),
    applyToUnitDecisions: formData.get("applyToUnitDecisions") === "true",
    questions: parsedQuestions,
    vatmUnitRecommendations: parsedUnits,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data penilaian wawancara tidak valid.",
    };
  }

  const data = parsed.data;
  if (data.overallRecommendation === "BK" && !data.assessorNotes.trim()) {
    return {
      ok: false,
      error: "Catatan asesor wajib diisi apabila rekomendasi wawancara adalah BK.",
    };
  }

  const [batch, assessee, authz] = await Promise.all([
    getBatchById(user.id, data.batchId),
    getAssesseeById(user.id, data.assesseeId),
    resolveAuthorizedLsp(user.id, ["lsp_admin", "assessor"]),
  ]);

  if (!batch || !assessee || assessee.batchId !== batch.id) {
    return { ok: false, error: "Batch atau asesi tidak ditemukan." };
  }
  if (!authz.allowed) {
    return { ok: false, error: "Peran Anda tidak berwenang menyimpan penilaian wawancara." };
  }

  const normalizedQuestions = data.questions.map((q, idx) => ({
    ...q,
    no: idx + 1,
  }));

  await saveInterviewAssessment({
    userId: user.id,
    lspId: batch.lspId,
    batchId: batch.id,
    assesseeId: assessee.id,
    sourceFileId: data.sourceFileId,
    questions: normalizedQuestions,
    overallRecommendation: data.overallRecommendation,
    vatmUnitRecommendations: data.vatmUnitRecommendations,
    assessorNotes: data.assessorNotes,
  });

  const schemes = await listSchemes(user.id, batch.lspId);
  const scheme = schemes.find((s) => s.id === batch.schemeId) ?? null;

  const rollup = await syncAssesseeVatmRecommendations({
    userId: user.id,
    lspId: batch.lspId,
    batchId: batch.id,
    assesseeId: assessee.id,
    scheme,
  });

  if (data.applyToUnitDecisions) {
    const rollupMap = new Map(rollup.map((r) => [r.unitCode, r]));
    await Promise.all(
      data.vatmUnitRecommendations.map((u) => {
        const r = rollupMap.get(u.unitCode);
        return upsertUnitDecision({
          userId: user.id,
          lspId: batch.lspId,
          batchId: batch.id,
          assesseeId: assessee.id,
          unitCode: u.unitCode,
          unitTitle: u.unitTitle,
          aiRecommendation: r?.aiRecommendation ?? u.recommendation,
          vatmReasoning: r?.vatmReasoning ?? u.reasoning,
          decision: u.recommendation,
          assessorNote:
            u.recommendation === "BK"
              ? u.reasoning || data.assessorNotes
              : data.assessorNotes || undefined,
        });
      }),
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "interview.ia09.save",
        resource: "assessees",
        resource_id: assessee.id,
        after_summary: {
          batchId: batch.id,
          overallRecommendation: data.overallRecommendation,
          questionCount: data.questions.length,
          appliedToDecisions: data.applyToUnitDecisions,
        },
      },
      supabase,
    );
  } catch {
    // non-fatal audit error
  }

  revalidatePath(`/batches/${batch.id}/assessees/${assessee.id}`);
  revalidatePath(`/batches/${batch.id}/assessees/${assessee.id}/interview`);
  revalidatePath(`/batches/${batch.id}/ak05`);

  return {
    ok: true,
    message: `Penilaian wawancara FR.IA.09 (${data.overallRecommendation}) tersimpan dan roll-up VATM diperbarui.`,
  };
}

export async function generateInterviewQuestionsAction(formData: FormData): Promise<{
  ok: boolean;
  questions?: Array<{
    no: number;
    question: string;
    answerSummary: string;
    achieved: null;
    unitCode?: string;
    dimension?: "TS" | "TMS" | "CMS" | "JRES" | "TrS";
  }>;
  message?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };

  const batchId = String(formData.get("batchId") ?? "").trim();
  const assesseeId = String(formData.get("assesseeId") ?? "").trim();
  if (!isUuid(batchId) || !isUuid(assesseeId)) {
    return { ok: false, error: "Parameter wawancara tidak valid." };
  }

  const rate = checkRateLimit(`interview:generate:${user.id}:${assesseeId}`, 15, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak permintaan pembuatan pertanyaan AI. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const [batch, assessee, authz] = await Promise.all([
    getBatchById(user.id, batchId),
    getAssesseeById(user.id, assesseeId),
    resolveAuthorizedLsp(user.id, ["lsp_admin", "assessor"]),
  ]);
  if (!batch || !assessee || assessee.batchId !== batch.id) {
    return { ok: false, error: "Batch atau asesi tidak ditemukan." };
  }
  if (!authz.allowed) {
    return { ok: false, error: "Peran Anda tidak berwenang menghasilkan pertanyaan wawancara." };
  }

  const [schemes, lspName, providerCfg, files, latestDit] = await Promise.all([
    listSchemes(user.id, batch.lspId),
    getLspNameForUser(user.id, batch.lspId),
    getLatestProviderConfigForAssessor(user.id),
    listDriveFilesForBatch(user.id, batchId),
    getLatestDitAnalysis(user.id, assesseeId),
  ]);
  const scheme = schemes.find((s) => s.id === batch.schemeId) ?? null;
  if (!scheme) return { ok: false, error: "Skema batch tidak ditemukan." };

  const units = resolveUnitsForScheme(scheme);
  const manifestQuestions = resolveSchemeInterviewQuestions(scheme);
  const questionCount = manifestQuestions.length || units.length;
  if (questionCount < 1) {
    return {
      ok: false,
      error: "Jumlah pertanyaan wawancara belum terkonfigurasi pada manifes skema.",
    };
  }
  if (!providerCfg?.encryptedApiKey) {
    return { ok: false, error: "Konfigurasi AI (BYOK) belum tersedia di Penyedia AI." };
  }

  let llmConfig;
  try {
    llmConfig = {
      provider: providerCfg.provider,
      apiKey: decryptSecret(providerCfg.encryptedApiKey),
      baseUrl: providerCfg.baseUrl,
      gatewayToken: providerCfg.encryptedGatewayToken
        ? decryptSecret(providerCfg.encryptedGatewayToken)
        : null,
      model: providerCfg.model,
      temperature: providerCfg.temperature,
      maxTokens: providerCfg.maxTokens,
    };
  } catch {
    return { ok: false, error: "Kunci BYOK tidak dapat dibaca. Periksa konfigurasi Penyedia AI." };
  }

  const pseudonym = assessee.pseudonym ?? "ASESI";
  const sensitiveNames = [
    assessee.displayName,
    assessee.apl01Name,
    assessee.ktpNameOcr,
    assessee.suratTugasName,
    assessee.ijazahName,
    assessee.certificateNameConfirmed,
  ];
  const scrub = (raw: string) => scrubCandidateIdentityText(raw, sensitiveNames, pseudonym);

  const fr09Text = scrub(
    files
      .filter((f) => f.assesseeId === assesseeId && f.docType === "09")
      .map((f) => f.extractedText ?? "")
      .join("\n")
      .slice(0, 20_000),
  );

  const cvExcerpt = scrub(
    files
      .filter((f) => f.assesseeId === assesseeId && f.docType === "cv")
      .map((f) => f.extractedText ?? "")
      .join("\n")
      .slice(0, 5_000),
  );
  const fr04bExcerpt = scrub(
    files
      .filter((f) => f.assesseeId === assesseeId && f.docType === "04b")
      .map((f) => f.extractedText ?? "")
      .join("\n")
      .slice(0, 6_000),
  );
  const fr04aExcerpt = scrub(
    files
      .filter(
        (f) =>
          f.docType === "04a" &&
          (f.assesseeId === assesseeId || f.assesseeId === null),
      )
      .map((f) => f.extractedText ?? "")
      .join("\n")
      .slice(0, 3_000),
  );

  let ditSummaryText = "";
  if (latestDit && typeof latestDit === "object") {
    const rawDit = latestDit as Record<string, unknown>;
    const rawOutput =
      (rawDit.rawOutput ?? rawDit.raw_output) && typeof (rawDit.rawOutput ?? rawDit.raw_output) === "object"
        ? ((rawDit.rawOutput ?? rawDit.raw_output) as Record<string, unknown>)
        : null;
    const ditCandidateProfile = rawOutput?.candidateProfileSummary ?? null;
    const ditReadiness = rawDit.readiness ?? rawOutput?.readiness ?? null;
    const ditGaps = rawDit.gapQuestions ?? rawDit.gap_questions ?? rawOutput?.gapQuestions ?? null;
    const compactDit = {
      candidateProfileSummary: ditCandidateProfile,
      readiness: ditReadiness,
      gapQuestions: Array.isArray(ditGaps) ? ditGaps.slice(0, 8) : [],
    };
    ditSummaryText = scrub(JSON.stringify(compactDit).slice(0, 5_000));
  }

  const profileSections = [`Pseudonim: ${pseudonym}`];
  if (cvExcerpt) profileSections.push(`[Ringkasan CV / Riwayat Kerja]\n${cvExcerpt}`);
  if (fr04bExcerpt) profileSections.push(`[Materi / Presentasi FR.IA.04B]\n${fr04bExcerpt}`);
  if (fr04aExcerpt) profileSections.push(`[Instruksi FR.IA.04A]\n${fr04aExcerpt}`);
  if (ditSummaryText) profileSections.push(`[Ringkasan Analisis DIT]\n${ditSummaryText}`);
  if (profileSections.length === 1) {
    profileSections.push(
      "[Catatan Bahan]: Ringkasan CV, presentasi DIT, dan dokumen pendukung belum terekstraksi. Gunakan unit kompetensi aktif serta tanda bila bahan masih kurang.",
    );
  }
  const profile = profileSections.join("\n\n");

  const result = await runInterviewPipeline({
    pseudonym,
    lspName: lspName ?? "-",
    schemeName: scheme.name,
    schemeCode: scheme.code,
    questionCount,
    units,
    legalRefs: scheme.manifest.decisionRuleRef
      ? [scheme.manifest.decisionRuleRef]
      : [],
    candidateProfileSummary: profile,
    fr09Text,
    llmConfig,
    correlationId: `interview-${assesseeId}`,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: `Pertanyaan wawancara gagal dibuat (${result.reason}): ${result.error ?? "kesalahan AI."}`,
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "interview.ia09.generate",
        resource: "assessees",
        resource_id: assessee.id,
        after_summary: {
          schemeCode: scheme.code,
          questionCount,
          promptVersion: result.promptVersion,
        },
      },
      supabase,
    );
  } catch {
    // non-fatal audit error
  }

  const normalizedQuestions = result.output.interviewQuestions.map((q, idx) => ({
    no: idx + 1,
    question: q.question,
    answerSummary: "",
    achieved: null as null,
    unitCode: q.unitCode,
    dimension: q.dimension,
  }));

  try {
    await persistInterviewDraftQuestions({
      userId: user.id,
      lspId: batch.lspId,
      batchId: batch.id,
      assesseeId: assessee.id,
      questions: normalizedQuestions,
    });
    revalidatePath(`/batches/${batch.id}/assessees/${assessee.id}/interview`);
  } catch {
    // non-fatal draft cache error
  }

  return {
    ok: true,
    questions: normalizedQuestions,
    message: `${questionCount} pertanyaan wawancara dibuat dari manifes skema ${scheme.code} dan disimpan sebagai draf.`,
  };
}

async function persistInterviewDraftQuestions(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  questions: Array<z.infer<typeof questionSchema>>;
}): Promise<void> {
  const normalized = params.questions.map((q, idx) => ({ ...q, no: idx + 1 }));
  await upsertDriveFilesForBatch({
    userId: params.userId,
    lspId: params.lspId,
    batchId: params.batchId,
    files: [
      {
        driveFileId: `manual-ia09-draft-${params.assesseeId}`,
        fileName: "FR.IA.09_Draft_Pertanyaan.json",
        mimeType: "application/json",
        drivePath: "Manual Input/FR.IA.09_Draft_Pertanyaan.json",
        docType: "ia09_draft",
        confidence: 1,
        assesseeId: params.assesseeId,
        triageStatus: "not_needed",
        triageReason: "Draf pertanyaan wawancara FR.IA.09",
        extractedText: JSON.stringify(normalized),
        extractionMethod: "ia09_draft",
        driveModifiedTime: new Date().toISOString(),
      },
    ],
  });
}

const saveInterviewDraftSchema = z.object({
  batchId: z.string().uuid(),
  assesseeId: z.string().uuid(),
  questions: z.array(questionSchema).min(1),
});

export async function saveInterviewDraftAction(formData: FormData): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  let parsedQuestions: unknown = [];
  try {
    parsedQuestions = JSON.parse(String(formData.get("questionsJson") ?? "[]"));
  } catch {
    return { ok: false, error: "Format JSON draf pertanyaan tidak valid." };
  }

  const parsed = saveInterviewDraftSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    assesseeId: String(formData.get("assesseeId") ?? "").trim(),
    questions: parsedQuestions,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Draf pertanyaan wawancara belum lengkap (isi teks pertanyaan terlebih dahulu).",
    };
  }

  const data = parsed.data;
  const rate = checkRateLimit(`interview:draft:${user.id}:${data.assesseeId}`, 30, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak permintaan simpan draf. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const [batch, assessee, authz] = await Promise.all([
    getBatchById(user.id, data.batchId),
    getAssesseeById(user.id, data.assesseeId),
    resolveAuthorizedLsp(user.id, ["lsp_admin", "assessor"]),
  ]);
  if (!batch || !assessee || assessee.batchId !== batch.id) {
    return { ok: false, error: "Batch atau asesi tidak ditemukan." };
  }
  if (!authz.allowed) {
    return { ok: false, error: "Peran Anda tidak berwenang menyimpan draf wawancara." };
  }

  await persistInterviewDraftQuestions({
    userId: user.id,
    lspId: batch.lspId,
    batchId: batch.id,
    assesseeId: assessee.id,
    questions: data.questions,
  });

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "interview.ia09.draft_save",
        resource: "assessees",
        resource_id: assessee.id,
        after_summary: {
          batchId: batch.id,
          questionCount: data.questions.length,
        },
      },
      supabase,
    );
  } catch {
    // non-fatal audit error
  }

  revalidatePath(`/batches/${batch.id}/assessees/${assessee.id}/interview`);
  return {
    ok: true,
    message: `Draf ${data.questions.length} pertanyaan wawancara tersimpan.`,
  };
}
