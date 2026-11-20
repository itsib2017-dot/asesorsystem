import { isUuid } from "@/db";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { logEvent } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listUserMemberships } from "@/repositories/auth.repository";
import { getBatchById } from "@/repositories/batches.repository";
import {
  enqueueJobRecord,
  getJobRecordById,
  updateJobStatusRecord,
  type JobRecord,
} from "@/repositories/jobs.repository";
import { runWorkerJob } from "./index";
import { isStaleRunningJob } from "./job-staleness";

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
  options?: { lspId?: string | null; triggerAction?: "retry" },
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

export async function getJobStatus(userId: string, jobId: string) {
  const job = await getJobRecordById(userId, jobId);
  if (!job) return null;

  // shortcut: a worker killed by the Vercel 300s timeout cannot update its own
  // row; surface a terminal state instead of polling "running" forever.
  if (isStaleRunningJob(job)) {
    await updateJobStatusRecord({
      userId,
      jobId,
      status: "failed",
      progress: job.progress,
      error: "Worker timeout (Vercel 300s). Jalankan ulang analisis.",
    });
    return getJobRecordById(userId, jobId);
  }

  return job;
}
