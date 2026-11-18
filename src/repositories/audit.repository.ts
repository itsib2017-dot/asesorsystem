import type { SupabaseClient } from "@supabase/supabase-js";
import { desc, eq } from "drizzle-orm";
import { hasDatabaseUrl, withRlsTransaction } from "@/db";
import { auditLog } from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface AuditInsertPayload {
  lsp_id: string | null;
  actor_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  before_summary: Record<string, unknown> | null;
  after_summary: Record<string, unknown> | null;
  break_glass_reason: string | null;
  correlation_id: string;
  ip: string | null;
  user_agent: string | null;
}

export interface AuditLogViewRow {
  id: number;
  lspId: string | null;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  afterSummary: Record<string, unknown> | null;
  correlationId: string;
  createdAt: string;
}

export async function insertAuditLogRecord(
  payload: AuditInsertPayload,
  supabase: SupabaseClient,
): Promise<{ error: { message: string } | null }> {
  return supabase.from("audit_log").insert(payload);
}

export async function listAuditLogsForUser(
  userId: string,
  lspId?: string,
  limit = 50,
): Promise<AuditLogViewRow[]> {
  if (hasDatabaseUrl()) {
    try {
      const rows = await withRlsTransaction(userId, (tx) => {
        const base = tx.select().from(auditLog);
        const filtered = lspId ? base.where(eq(auditLog.lspId, lspId)) : base;
        return filtered.orderBy(desc(auditLog.createdAt)).limit(limit);
      });
      return rows.map((r) => ({
        id: r.id,
        lspId: r.lspId,
        actorId: r.actorId,
        action: r.action,
        resource: r.resource,
        resourceId: r.resourceId,
        afterSummary: (r.afterSummary as Record<string, unknown> | null) ?? null,
        correlationId: r.correlationId,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch (err) {
      console.warn(
        "[AuditRepository Warning] Direct DB listAuditLogs fallback to Supabase REST:",
        err instanceof Error ? err.message : "unknown",
      );
    }
  }

  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("audit_log")
    .select("id, lsp_id, actor_id, action, resource, resource_id, after_summary, correlation_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (lspId) {
    query = query.eq("lsp_id", lspId);
  }

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    lspId: (r.lsp_id as string | null) ?? null,
    actorId: (r.actor_id as string | null) ?? null,
    action: String(r.action),
    resource: String(r.resource),
    resourceId: (r.resource_id as string | null) ?? null,
    afterSummary: (r.after_summary as Record<string, unknown> | null) ?? null,
    correlationId: String(r.correlation_id),
    createdAt: String(r.created_at),
  }));
}
