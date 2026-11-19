import { z } from "zod";
import { isUuid } from "@/db";
import { getUser } from "@/lib/auth/get-session";
import { decryptSecret } from "@/lib/crypto/encryption";
import { apiError, apiSuccess } from "@/lib/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getAssesseeById } from "@/repositories/assessees.repository";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { getLatestProviderConfigForAssessor } from "@/repositories/provider.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { checkDitCompletenessGate } from "@/services/dit";
import { resolveAssesseeDitInputs } from "@/services/drive-extract";
import { enqueueJob } from "@/worker/queue";

const analyseSchema = z.object({
  frIa04aText: z.string().optional(),
  presentationTranscript: z.string().optional(),
  candidateProfileSummary: z.string().optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ assesseeId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const rl = checkRateLimit(`dit:analyse:${user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(
      "RATE_LIMITED",
      `Terlalu banyak permintaan analisis AI. Coba lagi dalam ${rl.retryAfterSeconds} detik.`,
    );
  }

  const { assesseeId } = await context.params;
  if (!isUuid(assesseeId)) {
    return apiError("NOT_FOUND", "Asesi tidak ditemukan.");
  }

  const assessee = await getAssesseeById(user.id, assesseeId);
  if (!assessee) {
    return apiError("NOT_FOUND", "Asesi tidak ditemukan.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = analyseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Format permintaan tidak valid.");
  }

  const body04a = parsed.data.frIa04aText?.trim() ?? "";
  const body04b = parsed.data.presentationTranscript?.trim() ?? "";
  const bodyCv = parsed.data.candidateProfileSummary?.trim() ?? "";

  let resolvedInputs = {
    frIa04aText: body04a,
    presentationTranscript: body04b,
    candidateProfileSummary: bodyCv,
    extractionErrors: [] as string[],
  };

  if (!body04a || !body04b || !bodyCv) {
    const [batchFiles, batch, schemes, providerCfg] = await Promise.all([
      listDriveFilesForBatch(user.id, assessee.batchId),
      getBatchById(user.id, assessee.batchId),
      listSchemes(user.id, assessee.lspId),
      getLatestProviderConfigForAssessor(user.id),
    ]);
    const assesseeFiles = batchFiles.filter((f) => f.assesseeId === assesseeId);
    const scheme = batch?.schemeId ? (schemes.find((s) => s.id === batch.schemeId) ?? null) : null;
    let driveApiKey: string | undefined;
    if (providerCfg?.googleDriveApiKeyEncrypted) {
      try {
        driveApiKey = decryptSecret(providerCfg.googleDriveApiKeyEncrypted) || undefined;
      } catch {
        driveApiKey = undefined;
      }
    }

    const fromDb = await resolveAssesseeDitInputs({
      userId: user.id,
      files: assesseeFiles,
      batchFiles,
      scheme,
      apiKey: driveApiKey,
    });

    resolvedInputs = {
      frIa04aText: body04a || fromDb.frIa04aText,
      presentationTranscript: body04b || fromDb.presentationTranscript,
      candidateProfileSummary: bodyCv || fromDb.candidateProfileSummary,
      extractionErrors: fromDb.extractionErrors,
    };
  }

  // Enforce Rule 26 Completeness Gate before enqueueing
  const gate = checkDitCompletenessGate({
    frIa04aText: resolvedInputs.frIa04aText,
    presentationTranscript: resolvedInputs.presentationTranscript,
    candidateProfileSummary: resolvedInputs.candidateProfileSummary,
  });
  if (!gate.passed) {
    const errorSuffix =
      resolvedInputs.extractionErrors.length > 0
        ? ` (${resolvedInputs.extractionErrors.join("; ")})`
        : "";
    return apiError(
      "UNPROCESSABLE",
      `Analisis ditunda — bahan belum lengkap.${errorSuffix}`,
      gate.missing.map((m) => ({
        field: m.input,
        issue: `Dokumen wajib belum tersedia: ${m.label}`,
      })),
    );
  }

  const jobRes = await enqueueJob({
    userId: user.id,
    lspId: assessee.lspId,
    type: "dit_analysis",
    payload: {
      assesseeId,
      batchId: assessee.batchId,
      frIa04aText: resolvedInputs.frIa04aText,
      presentationTranscript: resolvedInputs.presentationTranscript,
      candidateProfileSummary: resolvedInputs.candidateProfileSummary,
    },
  });

  if (!jobRes.ok) {
    return apiError("INTERNAL_ERROR", jobRes.error);
  }

  return apiSuccess(
    {
      job_id: jobRes.job.id,
      status: jobRes.job.status,
      progress: jobRes.job.progress,
      ...(jobRes.job.error ? { error: jobRes.job.error } : {}),
    },
    undefined,
    202,
  );
}
