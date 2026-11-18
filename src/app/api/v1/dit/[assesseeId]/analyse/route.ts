import { z } from "zod";
import { getUser } from "@/lib/auth/get-session";
import { apiError, apiSuccess } from "@/lib/errors";
import { checkDitCompletenessGate } from "@/services/dit";
import { enqueueJob } from "@/worker/queue";
import { getAssesseeById } from "@/repositories/assessees.repository";

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

  const { assesseeId } = await context.params;
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

  // Enforce Rule 26 Completeness Gate before enqueueing
  const gate = checkDitCompletenessGate(parsed.data);
  if (!gate.passed) {
    return apiError(
      "UNPROCESSABLE",
      "Analisis ditunda — bahan belum lengkap.",
      gate.missing.map((m) => ({ field: m.input, issue: `Dokumen wajib belum tersedia: ${m.label}` })),
    );
  }

  const jobRes = await enqueueJob({
    userId: user.id,
    type: "dit_analysis",
    payload: { assesseeId, batchId: assessee.batchId },
  });

  if (!jobRes.ok) {
    return apiError("INTERNAL_ERROR", jobRes.error);
  }

  return apiSuccess({ job_id: jobRes.job.id, status: "queued" }, undefined, 202);
}
