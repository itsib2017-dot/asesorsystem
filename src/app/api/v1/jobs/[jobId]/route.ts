import { getUser } from "@/lib/auth/get-session";
import { apiError, apiSuccess } from "@/lib/errors";
import { executeJob, getJobStatus } from "@/worker/queue";

export async function GET(
  _req: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const { jobId } = await context.params;
  const job = await getJobStatus(user.id, jobId);
  if (!job) {
    return apiError("NOT_FOUND", "Pekerjaan tidak ditemukan.");
  }

  return apiSuccess(job);
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const { jobId } = await context.params;
  const job = await executeJob(user.id, jobId);
  if (!job) {
    return apiError("NOT_FOUND", "Pekerjaan tidak ditemukan.");
  }

  return apiSuccess(job);
}
