import { eq } from "drizzle-orm";
import { hasDatabaseUrl, withRlsTransaction } from "@/db";
import { jobs } from "@/db/schema";
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

export async function enqueueJobRecord(params: {
  createdBy: string;
  type: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: true; job: JobRecord } | { ok: false; error: string }> {
  if (hasDatabaseUrl()) {
    try {
      const [row] = await withRlsTransaction(params.createdBy, (tx) =>
        tx
          .insert(jobs)
          .values({
            createdBy: params.createdBy,
            type: params.type,
            status: "pending",
            payload: params.payload,
            progress: 0,
          })
          .returning(),
      );
      if (!row) return { ok: false, error: "Insert returned empty" };
      return {
        ok: true,
        job: {
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
        },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "DB error" };
    }
  }

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
    return { ok: false, error: error?.message ?? "Failed to enqueue job" };
  }

  return {
    ok: true,
    job: {
      id: data.id as string,
      createdBy: (data.created_by as string | null) ?? null,
      type: data.type as string,
      status: data.status as JobRecord["status"],
      payload: (data.payload ?? {}) as Record<string, unknown>,
      progress: Number(data.progress ?? 0),
      error: (data.error as string | null) ?? null,
      attempts: Number(data.attempts ?? 0),
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    },
  };
}

export async function getJobRecordById(
  userId: string,
  jobId: string,
): Promise<JobRecord | null> {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx.select().from(jobs).where(eq(jobs.id, jobId)).limit(1),
    );
    const row = rows[0];
    if (!row) return null;
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

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    createdBy: (data.created_by as string | null) ?? null,
    type: data.type as string,
    status: data.status as JobRecord["status"],
    payload: (data.payload ?? {}) as Record<string, unknown>,
    progress: Number(data.progress ?? 0),
    error: (data.error as string | null) ?? null,
    attempts: Number(data.attempts ?? 0),
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}
