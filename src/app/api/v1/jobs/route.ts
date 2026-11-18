import { getUser } from "@/lib/auth/get-session";
import { apiError, apiSuccess } from "@/lib/errors";
import { listJobsForUser } from "@/repositories/jobs.repository";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId")?.trim() || null;

  const jobs = await listJobsForUser(user.id, 50);
  const filtered = batchId
    ? jobs.filter((j) => String(j.payload?.batchId ?? "") === batchId)
    : jobs;

  return apiSuccess(filtered);
}
