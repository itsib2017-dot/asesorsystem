import { desc, eq } from "drizzle-orm";
import { hasDatabaseUrl, isUuid, runRepositoryDualPath, withRlsTransaction } from "@/db";
import { jobs } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface JobRecord {
  id: string;
  createdBy: string | null;
  type: string;
  status: "pending" | "running" | "done" | "failed";
  payload: Record<string, unknown>;
  progress: number;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

function mapSupabaseJobRow(data: Record<string, unknown>): JobRecord {
  return {
    id: data.id as string,
    createdBy: (data.created_by as string | null) ?? null,
    type: data.type as string,
    status: data.status as JobRecord["status"],
    payload: (data.payload ?? {}) as Record<string, unknown>,
    progress: Number(data.progress ?? 0),
    error: (data.error as string | null) ?? null,
    attempts: Number(data.attempts ?? 0),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}

function mapDrizzleJobRow(row: typeof jobs.$inferSelect): JobRecord {
  return {
    id: row.id,
    createdBy: row.createdBy,
    type: row.type,
    status: row.status as JobRecord["status"],
    payload: (row.payload ?? {}) as Record<string, unknown>,
    progress: row.progress,
    error: row.error,
    attempts: row.attempts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function enqueueJobRecord(params: {
  createdBy: string;
  type: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: true; job: JobRecord } | { ok: false; error: string }> {
  return runRepositoryDualPath({
    userId: params.createdBy,
    label: "JobsRepository.enqueueJob",
    drizzle: async (tx) => {
      const [row] = await tx
        .insert(jobs)
        .values({
          createdBy: params.createdBy,
          type: params.type,
          status: "pending",
          payload: params.payload,
          progress: 0,
        })
        .returning();
      if (!row) throw new Error("Empty returning row");
      return { ok: true as const, job: mapDrizzleJobRow(row) };
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          created_by: params.createdBy,
          type: params.type,
          status: "pending",
          payload: params.payload,
          progress: 0,
        })
        .select("*")
        .single();

      if (error || !data) {
        return { ok: false as const, error: error?.message ?? "Failed to enqueue job" };
      }

      return {
        ok: true as const,
        job: mapSupabaseJobRow(data as Record<string, unknown>),
      };
    },
  });
}

export async function getJobRecordById(
  userId: string,
  jobId: string,
): Promise<JobRecord | null> {
  if (!isUuid(jobId)) return null;
  return runRepositoryDualPath({
    userId,
    label: "JobsRepository.getJob",
    drizzle: async (tx) => {
      const rows = await tx.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
      const row = rows[0];
      return row ? mapDrizzleJobRow(row) : null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (error || !data) return null;
      return mapSupabaseJobRow(data as Record<string, unknown>);
    },
  });
}

export async function listJobsForUser(
  userId: string,
  limit = 20,
): Promise<JobRecord[]> {
  return runRepositoryDualPath({
    userId,
    label: "JobsRepository.listJobs",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.createdBy, userId))
        .orderBy(desc(jobs.createdAt))
        .limit(limit);
      return rows.map(mapDrizzleJobRow);
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      return (data ?? []).map((row) => mapSupabaseJobRow(row as Record<string, unknown>));
    },
  });
}

export async function getLatestJobForBatch(
  userId: string,
  batchId: string,
): Promise<JobRecord | null> {
  if (!isUuid(batchId)) return null;
  const recent = await listJobsForUser(userId, 50);
  return (
    recent.find((j) => String(j.payload?.batchId ?? "") === batchId) ?? null
  );
}

export async function updateJobStatusRecord(params: {
  userId: string;
  jobId: string;
  status: "pending" | "running" | "done" | "failed";
  progress: number;
  error?: string | null;
  attempts?: number;
}): Promise<void> {
  const now = new Date();
  if (hasDatabaseUrl()) {
    try {
      const updated = await withRlsTransaction(params.userId, (tx) =>
        tx
          .update(jobs)
          .set({
            status: params.status,
            progress: params.progress,
            error: params.error ?? null,
            ...(params.attempts !== undefined ? { attempts: params.attempts } : {}),
            updatedAt: now,
          })
          .where(eq(jobs.id, params.jobId))
          .returning({ id: jobs.id }),
      );
      if (updated.length > 0) return;
    } catch (err) {
      console.warn(
        "[JobsRepository Warning] Direct DB updateJob fallback to Supabase REST:",
        err instanceof Error ? err.message : "unknown",
      );
    }
  }

  const supabase = await getSupabaseServerClient();
  const updatePayload: Record<string, unknown> = {
    status: params.status,
    progress: params.progress,
    error: params.error ?? null,
    updated_at: now.toISOString(),
  };
  if (params.attempts !== undefined) {
    updatePayload.attempts = params.attempts;
  }

  const { data, error } = await supabase
    .from("jobs")
    .update(updatePayload)
    .eq("id", params.jobId)
    .eq("created_by", params.userId)
    .select("id");

  if (!error && Array.isArray(data) && data.length > 0) {
    return;
  }

  // Fallback for background/server worker execution scoped strictly to owner
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const admin = getSupabaseAdminClient();
    const { error: adminError } = await admin
      .from("jobs")
      .update(updatePayload)
      .eq("id", params.jobId)
      .eq("created_by", params.userId);

    await writeAuditLog(
      {
        actor_id: params.userId,
        action: `worker.job_status.${params.status}`,
        resource: "jobs",
        resource_id: params.jobId,
        after_summary: {
          status: params.status,
          progress: params.progress,
          admin_fallback_error: adminError?.message ?? null,
        },
      },
      admin,
    );
  }
}
