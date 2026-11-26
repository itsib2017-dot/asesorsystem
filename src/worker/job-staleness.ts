export const STALE_RUNNING_MS = 305_000;
export const STALE_PENDING_MS = 60_000;

export function isStaleRunningJob(
  job: { status: string; updatedAt: string },
  now: number = Date.now(),
): boolean {
  return (
    job.status === "running" &&
    now - Date.parse(job.updatedAt) > STALE_RUNNING_MS
  );
}

export function isStalePendingJob(
  job: { status: string; updatedAt: string },
  now: number = Date.now(),
): boolean {
  return (
    job.status === "pending" &&
    now - Date.parse(job.updatedAt) > STALE_PENDING_MS
  );
}

export function getStaleJobReason(
  job: { status: string; updatedAt: string },
  now: number = Date.now(),
): string | null {
  if (isStaleRunningJob(job, now)) {
    return "Worker timeout (Vercel 300s). Jalankan ulang pemindaian / analisis.";
  }
  if (isStalePendingJob(job, now)) {
    return "Antrean job tidak dimulai dalam 60 detik (konteks latar terhenti). Jalankan ulang pemindaian / analisis.";
  }
  return null;
}
