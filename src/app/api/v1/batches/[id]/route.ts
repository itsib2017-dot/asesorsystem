import { getUser } from "@/lib/auth/get-session";
import { apiError, apiSuccess } from "@/lib/errors";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { getLatestJobForBatch } from "@/repositories/jobs.repository";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const { id } = await context.params;
  const [batch, latestJob, assessees, files] = await Promise.all([
    getBatchById(user.id, id),
    getLatestJobForBatch(user.id, id, "drive_scan"),
    listAssesseesByBatch(user.id, id),
    listDriveFilesForBatch(user.id, id),
  ]);

  if (!batch) {
    return apiError("NOT_FOUND", "Batch tidak ditemukan.");
  }

  return apiSuccess({
    ...batch,
    ingestJobId: latestJob?.id ?? null,
    ingestStatus: latestJob?.status ?? null,
    latestJob: latestJob
      ? {
          id: latestJob.id,
          type: latestJob.type,
          status: latestJob.status,
          progress: latestJob.progress,
          error: latestJob.error,
          attempts: latestJob.attempts,
          updatedAt: latestJob.updatedAt,
        }
      : null,
    assesseeCount: assessees.length,
    fileCount: files.length,
  });
}
