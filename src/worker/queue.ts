import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { logEvent } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  enqueueJobRecord,
  getJobRecordById,
  updateJobStatusRecord,
  type JobRecord,
} from "@/repositories/jobs.repository";
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

  let outcomeStatus: "done" | "failed" = "done";
  let resultMeta: Record<string, unknown> | undefined;
  let errorMessage: string | undefined;

  try {
    const result = await runWorkerJob({
      id: job.id,
      type: job.type,
      payload: job.payload,
      userId,
    });

    resultMeta = result.meta;
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
    outcomeStatus = "failed";
    errorMessage = message;
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

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        actor_id: userId,
        action:
          outcomeStatus === "done"
            ? `job.${job.type}.completed`
            : `job.${job.type}.failed`,
        resource: "jobs",
        resource_id: job.id,
        after_summary: {
          type: job.type,
          batchId: job.payload?.batchId ?? null,
          status: outcomeStatus,
          ...(resultMeta ?? {}),
          ...(errorMessage ? { error: errorMessage } : {}),
        },
        correlation_id: job.id,
      },
      supabase,
    );
  } catch {
    // Do not break worker execution or unit tests outside Next request scope
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
