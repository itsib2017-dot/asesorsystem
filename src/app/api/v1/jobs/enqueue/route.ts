import { z } from "zod";
import { getUser } from "@/lib/auth/get-session";
import { apiError, apiSuccess } from "@/lib/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enqueueJob, type JobType } from "@/worker/queue";

const enqueueSchema = z.object({
  type: z.enum([
    "hello",
    "drive_scan",
    "extract_file",
    "ocr_ktp",
    "dit_analysis",
    "written_grading",
    "similarity_run",
    "ak05_export",
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid atau telah kedaluwarsa.");
  }

  const rl = checkRateLimit(`jobs:enqueue:${user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(
      "RATE_LIMITED",
      `Terlalu banyak antrean pekerjaan. Coba lagi dalam ${rl.retryAfterSeconds} detik.`,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body JSON tidak valid.");
  }

  const parsed = enqueueSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Parameter job tidak valid.",
      parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
    );
  }

  const result = await enqueueJob({
    userId: user.id,
    type: parsed.data.type as JobType,
    payload: parsed.data.payload,
  });

  if (!result.ok) {
    return apiError("INTERNAL_ERROR", result.error);
  }

  return apiSuccess({ job_id: result.job.id, status: result.job.status }, undefined, 202);
}
