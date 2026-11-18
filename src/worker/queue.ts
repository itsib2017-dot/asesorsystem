import {
  enqueueJobRecord,
  getJobRecordById,
  updateJobStatusRecord,
  type JobRecord,
} from "@/repositories/jobs.repository";
import { logEvent } from "@/lib/logger";
import { runWorkerJob } from "./index";

export type JobType =
  | "hello"
  | "drive_scan"
  | "extract_file"
  | "ocr_ktp"
  | "dit_analysis"
  | "written_grading"
  | "similarity_run"
  | "ak05_export";

export async function executeJob(
  userId: string,
  jobId: string,
): Promise<JobRecord | null> {
  const job = await getJobRecordById(userId, jobId);
  if (!job) return null;

  const nextAttempts = job.attempts + 1;
  await updateJobStatusRecord({
    userId,
    jobId: job.id,
    status: "running",
    progress: 10,
    error: null,
    attempts: nextAttempts,
  });

  try {
    const result = await runWorkerJob({
      id: job.id,
      type: job.type,
      payload: job.payload,
      userId,
    });

    await updateJobStatusRecord({
      userId,
      jobId: job.id,
      status: "done",
      progress: result.progress,
      error: null,
      attempts: nextAttempts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Worker execution failed";
    logEvent("error", {
      correlation_id: job.id,
      action: `worker.execute.${job.type}`,
      resource: "jobs",
      outcome: "failure",
      meta: { error: message },
    });

    await updateJobStatusRecord({
      userId,
      jobId: job.id,
      status: "failed",
      progress: 0,
      error: message,
      attempts: nextAttempts,
    });
  }

  return getJobRecordById(userId, job.id);
}

export async function enqueueJob(params: {
  userId: string;
  type: JobType;
  payload: Record<string, unknown>;
  runImmediately?: boolean;
}) {
  const enqueued = await enqueueJobRecord({
    createdBy: params.userId,
    type: params.type,
    payload: params.payload,
  });

  if (!enqueued.ok) {
    return enqueued;
  }

  if (params.runImmediately !== false) {
    const executed = await executeJob(params.userId, enqueued.job.id);
    if (executed) {
      return { ok: true as const, job: executed };
    }
  }

  return enqueued;
}

export async function getJobStatus(userId: string, jobId: string) {
  return getJobRecordById(userId, jobId);
}
