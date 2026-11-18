import type { SupabaseClient } from "@supabase/supabase-js";
import { desc, eq, inArray, isNull, or } from "drizzle-orm";
import { hasDatabaseUrl, withRlsTransaction } from "@/db";
import { assessors, auditLog, lspMemberships } from "@/db/schema";
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
  actorName: string | null;
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
      const result = await withRlsTransaction(userId, async (tx) => {
        const members = lspId
          ? await tx
              .select({ assessorId: lspMemberships.assessorId })
              .from(lspMemberships)
              .where(eq(lspMemberships.lspId, lspId))
          : [];
        const memberIds = members.map((m) => m.assessorId);
        const actorRows =
          memberIds.length > 0
            ? await tx
                .select({ id: assessors.id, fullName: assessors.fullName })
                .from(assessors)
                .where(inArray(assessors.id, memberIds))
            : [];

        const base = tx.select().from(auditLog);
        const filtered = lspId
          ? memberIds.length > 0
            ? base.where(
                or(
                  eq(auditLog.lspId, lspId),
                  isNull(auditLog.lspId),
                ),
              )
            : base.where(eq(auditLog.lspId, lspId))
          : base;

        const rows = await filtered.orderBy(desc(auditLog.createdAt)).limit(limit);
        return { rows, actorRows, memberIds };
      });

      const memberSet = new Set(result.memberIds);
      const actorNameMap = new Map(result.actorRows.map((a) => [a.id, a.fullName]));

      return result.rows
        .filter(
          (r) =>
            !lspId ||
            r.lspId === lspId ||
            (r.lspId === null && r.actorId !== null && memberSet.has(r.actorId)),
        )
        .map((r) => ({
          id: r.id,
          lspId: r.lspId,
          actorId: r.actorId,
          actorName: r.actorId ? (actorNameMap.get(r.actorId) ?? null) : null,
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
  let memberSet = new Set<string>();
  const actorNameMap = new Map<string, string>();

  if (lspId) {
    const { data: members } = await supabase
      .from("lsp_memberships")
      .select("assessor_id")
      .eq("lsp_id", lspId);
    const ids = (members ?? []).map((m) => String(m.assessor_id));
    memberSet = new Set(ids);

    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("assessors")
        .select("id, full_name")
        .in("id", ids);
      for (const p of profiles ?? []) {
        actorNameMap.set(String(p.id), String(p.full_name));
      }
    }
  }

  let query = supabase
    .from("audit_log")
    .select("id, lsp_id, actor_id, action, resource, resource_id, after_summary, correlation_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (lspId) {
    query = query.or(`lsp_id.eq.${lspId},lsp_id.is.null`);
  }

  const { data } = await query;
  return (data ?? [])
    .filter(
      (r) =>
        !lspId ||
        r.lsp_id === lspId ||
        (r.lsp_id === null && r.actor_id !== null && memberSet.has(String(r.actor_id))),
    )
    .map((r) => {
      const actorId = (r.actor_id as string | null) ?? null;
      return {
        id: Number(r.id),
        lspId: (r.lsp_id as string | null) ?? null,
        actorId,
        actorName: actorId ? (actorNameMap.get(actorId) ?? null) : null,
        action: String(r.action),
        resource: String(r.resource),
        resourceId: (r.resource_id as string | null) ?? null,
        afterSummary: (r.after_summary as Record<string, unknown> | null) ?? null,
        correlationId: String(r.correlation_id),
        createdAt: String(r.created_at),
      };
    });
}
