import { after } from "next/server";
import { z } from "zod";
import { isUuid } from "@/db";
import { requireLspRole } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { apiError, apiSuccess } from "@/lib/errors";
import { formatSchemeInstructionsText, selectDitInputFiles } from "@/lib/forms/dit-inputs";
import { logEvent } from "@/lib/logger";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getAssesseeById } from "@/repositories/assessees.repository";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { checkDitCompletenessGate } from "@/services/dit";
import { enqueueJob, executeJob } from "@/worker/queue";

export const maxDuration = 300;

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

  const roleCheck = await requireLspRole(assessee.lspId, user.id, ["lsp_admin", "assessor"]);
  if (!roleCheck.allowed) {
    return apiError(
      "FORBIDDEN",
      "Akses ditolak: hanya Asesor atau Admin LSP yang berwenang menjalankan analisis DIT.",
    );
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

  let gate04a = body04a;
  let gate04b = body04b;
  let gateCv = bodyCv;

  // Fast metadata-only completeness gate (<100ms, zero Drive network IO).
  // Actual file download & text extraction run inside the background worker via after().
  if (!body04a || !body04b || !bodyCv) {
    const [batchFiles, batch, schemes] = await Promise.all([
      listDriveFilesForBatch(user.id, assessee.batchId),
      getBatchById(user.id, assessee.batchId),
      listSchemes(user.id, assessee.lspId),
    ]);
    const assesseeFiles = batchFiles.filter((f) => f.assesseeId === assesseeId);
    const scheme = batch?.schemeId ? (schemes.find((s) => s.id === batch.schemeId) ?? null) : null;
    const selected = selectDitInputFiles(assesseeFiles, batchFiles);
    const schemeFallback =
      selected.used04aFiles.length === 0 ? formatSchemeInstructionsText(scheme) : "";

    if (!gate04a) {
      gate04a =
        selected.used04aFiles.length > 0 ? "pending-drive-extraction" : schemeFallback;
    }
    if (!gate04b) {
      gate04b =
        selected.combinedDitFiles.length > 0 ? "pending-drive-extraction" : "";
    }
    if (!gateCv) {
      gateCv = selected.usedCvFile ? "pending-drive-extraction" : "";
    }
  }

  // Enforce Rule 26 Completeness Gate before enqueueing
  const gate = checkDitCompletenessGate({
    frIa04aText: gate04a,
    presentationTranscript: gate04b,
    candidateProfileSummary: gateCv,
  });
  if (!gate.passed) {
    return apiError(
      "UNPROCESSABLE",
      "Analisis ditunda — bahan belum lengkap.",
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
    runImmediately: false,
    payload: {
      assesseeId,
      batchId: assessee.batchId,
      ...(body04a ? { frIa04aText: body04a } : {}),
      ...(body04b ? { presentationTranscript: body04b } : {}),
      ...(bodyCv ? { candidateProfileSummary: bodyCv } : {}),
    },
  });

  if (!jobRes.ok) {
    return apiError("INTERNAL_ERROR", jobRes.error);
  }

  after(async () => {
    try {
      await executeJob(user.id, jobRes.job.id, { lspId: assessee.lspId });
    } catch (err) {
      logEvent("error", {
        correlation_id: jobRes.job.id,
        user_id: user.id,
        tenant_id: assessee.lspId,
        action: "dit.analyse.after_execution",
        resource: "jobs",
        outcome: "failure",
        meta: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  });

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
