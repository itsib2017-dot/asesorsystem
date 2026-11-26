import { isUuid } from "@/db";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { logEvent } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listUserMemberships } from "@/repositories/auth.repository";
import { getBatchById } from "@/repositories/batches.repository";
import {
  enqueueJobRecord,
  getJobRecordById,
  getLatestJobForBatch,
  updateJobStatusRecord,
  type JobRecord,
} from "@/repositories/jobs.repository";
import { runWorkerJob } from "./index";
import { getStaleJobReason } from "./job-staleness";

export const WORKER_MAX_EXECUTION_MS = 240_000;

export type JobType =
  | "drive_scan"
  | "extract_file"
  | "ocr_ktp"
  | "dit_analysis"
  | "written_grading"
  | "similarity_run"
  | "ak05_export";

async function resolveJobLspId(
  userId: string,
  payload: Record<string, unknown>,
  explicitLspId?: string | null,
): Promise<string | null> {
  if (explicitLspId && isUuid(explicitLspId)) {
    return explicitLspId;
  }
  const batchId = typeof payload.batchId === "string" ? payload.batchId.trim() : "";
  if (batchId && isUuid(batchId)) {
    try {
      const batch = await getBatchById(userId, batchId);
      if (batch?.lspId) return batch.lspId;
    } catch {
      // Fall through to membership fallback
    }
  }
  try {
    const memberships = await listUserMemberships(userId);
    return memberships[0]?.lspId ?? null;
  } catch {
    return null;
  }
}

async function recordJobAuditEvent(params: {
  userId: string;
  lspId: string | null;
  job: Pick<JobRecord, "id" | "type" | "payload">;
  action: string;
  status: string;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const batchId =
    typeof params.job.payload?.batchId === "string" ? params.job.payload.batchId : null;
  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: params.lspId,
        actor_id: params.userId,
        action: params.action,
        resource: "jobs",
        resource_id: params.job.id,
        after_summary: {
          type: params.job.type,
          batchId,
          status: params.status,
          ...(params.extra ?? {}),
        },
        correlation_id: params.job.id,
      },
      supabase,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Unit tests call queue helpers outside Next.js cookies() request store
    if (!msg.includes("outside a request scope") && !msg.includes("cookies")) {
      logEvent("warn", {
        correlation_id: params.job.id,
        action: params.action,
        resource: "jobs",
        outcome: "failure",
        meta: { error: msg },
      });
    }
  }
}

export async function executeJob(
  userId: string,
  jobId: string,
  options?: { lspId?: string | null; triggerAction?: "retry"; timeoutMs?: number },
): Promise<JobRecord | null> {
  const job = await getJobRecordById(userId, jobId);
  if (!job) return null;

  // Guard: do not re-execute a job already in a terminal state unless an
  // explicit retry is requested. Prevents duplicate audit events (e.g.
  // job.drive_scan.failed written twice) when executeJob is invoked more
  // than once for the same job id (via enqueueJob and/or POST /api/v1/jobs/:id).
  const isTerminal = job.status === "done" || job.status === "failed";
  if (isTerminal && options?.triggerAction !== "retry") {
    return job;
  }

  const lspId = await resolveJobLspId(userId, job.payload, options?.lspId);

  if (options?.triggerAction === "retry") {
    await recordJobAuditEvent({
      userId,
      lspId,
      job,
      action: `job.${job.type}.retried`,
      status: job.status,
      extra: { attempts: job.attempts, trigger: "manual_retry" },
    });
  }

  const nextAttempts = job.attempts + 1;
  await updateJobStatusRecord({
    userId,
    jobId: job.id,
    status: "running",
    progress: 10,
    error: null,
    attempts: nextAttempts,
  });

  await recordJobAuditEvent({
    userId,
    lspId,
    job,
    action: `job.${job.type}.started`,
    status: "running",
    extra: { attempts: nextAttempts, progress: 10 },
  });

  let outcomeStatus: "done" | "failed" = "done";
  let resultMeta: Record<string, unknown> | undefined;
  let errorMessage: string | undefined;

  const onProgress = async (progress: number) => {
    const clamped = Math.max(1, Math.min(99, Math.round(progress)));
    try {
      await updateJobStatusRecord({
        userId,
        jobId: job.id,
        status: "running",
        progress: clamped,
        attempts: nextAttempts,
      });
    } catch {
      // Non-fatal progress heartbeat failure
    }
  };

  try {
    const controller = new AbortController();
    const effectiveTimeoutMs = options?.timeoutMs ?? WORKER_MAX_EXECUTION_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: Awaited<ReturnType<typeof runWorkerJob>>;
    try {
      result = await Promise.race([
        runWorkerJob({
          id: job.id,
          type: job.type,
          payload: job.payload,
          userId,
          signal: controller.signal,
          onProgress,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(
              new Error(
                `WORKER_EXECUTION_TIMEOUT: Pekerjaan ${job.type} melewati batas waktu eksekusi (${Math.round(effectiveTimeoutMs / 1000)} detik). Silakan jalankan ulang.`,
              ),
            );
          }, effectiveTimeoutMs);
        }),
      ]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }

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

  await recordJobAuditEvent({
    userId,
    lspId,
    job,
    action:
      outcomeStatus === "done"
        ? `job.${job.type}.completed`
        : `job.${job.type}.failed`,
    status: outcomeStatus,
    extra: {
      attempts: nextAttempts,
      ...(resultMeta ?? {}),
      ...(errorMessage ? { error: errorMessage } : {}),
    },
  });

  return getJobRecordById(userId, job.id);
}

export async function enqueueJob(params: {
  userId: string;
  type: JobType;
  payload: Record<string, unknown>;
  runImmediately?: boolean;
  lspId?: string | null;
  triggerAction?: "rescan";
}) {
  const enqueued = await enqueueJobRecord({
    createdBy: params.userId,
    type: params.type,
    payload: params.payload,
  });

  if (!enqueued.ok) {
    return enqueued;
  }

  const lspId = await resolveJobLspId(params.userId, params.payload, params.lspId);

  await recordJobAuditEvent({
    userId: params.userId,
    lspId,
    job: enqueued.job,
    action: `job.${params.type}.created`,
    status: enqueued.job.status,
    extra: params.triggerAction ? { trigger: params.triggerAction } : undefined,
  });

  if (params.triggerAction === "rescan") {
    await recordJobAuditEvent({
      userId: params.userId,
      lspId,
      job: enqueued.job,
      action: `job.${params.type}.rescan`,
      status: enqueued.job.status,
      extra: {
        driveFolderUrl:
          typeof params.payload.driveFolderUrl === "string"
            ? params.payload.driveFolderUrl
            : null,
      },
    });
  }

  if (params.runImmediately !== false) {
    const executed = await executeJob(params.userId, enqueued.job.id, { lspId });
    if (executed) {
      return { ok: true as const, job: executed };
    }
  }

  return enqueued;
}

export async function markJobFailedSafely(
  userId: string,
  jobId: string,
  errorMessage: string,
): Promise<void> {
  try {
    await updateJobStatusRecord({
      userId,
      jobId,
      status: "failed",
      progress: 0,
      error: errorMessage,
    });
  } catch (err) {
    logEvent("error", {
      correlation_id: jobId,
      user_id: userId,
      action: "worker.mark_failed_safely",
      resource: "jobs",
      outcome: "failure",
      meta: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

export async function reconcileStaleJob(
  userId: string,
  job: JobRecord | null,
): Promise<JobRecord | null> {
  if (!job) return null;
  const staleReason = getStaleJobReason(job);
  if (!staleReason) return job;

  // A worker killed by Vercel timeout or a dropped after() callback cannot update
  // its own row; reconcile stale pending/running states to terminal failed.
  try {
    await updateJobStatusRecord({
      userId,
      jobId: job.id,
      status: "failed",
      progress: job.progress,
      error: staleReason,
    });
    const lspId = await resolveJobLspId(userId, job.payload);
    await recordJobAuditEvent({
      userId,
      lspId,
      job,
      action: `job.${job.type}.failed`,
      status: "failed",
      extra: { error: staleReason, reason: "stale_reconciled" },
    });
    const refreshed = await getJobRecordById(userId, job.id);
    if (refreshed && refreshed.status === "failed") {
      return refreshed;
    }
  } catch {
    // Fall back to synthesized terminal view so callers never hang on stale state
  }

  return {
    ...job,
    status: "failed",
    error: staleReason,
  };
}

export async function getJobStatus(userId: string, jobId: string) {
  const job = await getJobRecordById(userId, jobId);
  return reconcileStaleJob(userId, job);
}

export async function getLatestJobStatusForBatch(
  userId: string,
  batchId: string,
  type?: string,
): Promise<JobRecord | null> {
  const latest = await getLatestJobForBatch(userId, batchId, type);
  return reconcileStaleJob(userId, latest);
}
