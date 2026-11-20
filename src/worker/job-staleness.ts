export const STALE_RUNNING_MS = 6 * 60_000;

export function isStaleRunningJob(
  job: { status: string; updatedAt: string },
  now: number = Date.now(),
): boolean {
  return (
    job.status === "running" &&
    now - Date.parse(job.updatedAt) > STALE_RUNNING_MS
  );
}
