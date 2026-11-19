import type { SupabaseClient } from "@supabase/supabase-js";
import { and, desc, eq, inArray, isNull, lt, or, type SQL } from "drizzle-orm";
import { isUuid, runRepositoryDualPath } from "@/db";
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
  limit = 100,
  beforeId?: number,
): Promise<AuditLogViewRow[]> {
  return runRepositoryDualPath({
    userId,
    label: "AuditRepository.listAuditLogs",
    drizzle: async (tx) => {
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

      const conditions: SQL[] = [];
      if (lspId) {
        if (memberIds.length > 0) {
          const tenantScope = or(
            eq(auditLog.lspId, lspId),
            and(isNull(auditLog.lspId), inArray(auditLog.actorId, memberIds)),
          );
          if (tenantScope) conditions.push(tenantScope);
        } else {
          conditions.push(eq(auditLog.lspId, lspId));
        }
      }
      if (typeof beforeId === "number" && Number.isFinite(beforeId) && beforeId > 0) {
        conditions.push(lt(auditLog.id, Math.floor(beforeId)));
      }

      const base = tx.select().from(auditLog);
      const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;

      const rows = await filtered
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(limit);
      const memberSet = new Set(memberIds);
      const actorNameMap = new Map(actorRows.map((a) => [a.id, a.fullName]));
      const seenIds = new Set<number>();

      return rows
        .filter((r) => {
          if (seenIds.has(r.id)) return false;
          seenIds.add(r.id);
          return (
            !lspId ||
            r.lspId === lspId ||
            (r.lspId === null && r.actorId !== null && memberSet.has(r.actorId))
          );
        })
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
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      let safeIds: string[] = [];
      let memberSet = new Set<string>();
      const actorNameMap = new Map<string, string>();

      if (lspId) {
        const { data: members } = await supabase
          .from("lsp_memberships")
          .select("assessor_id")
          .eq("lsp_id", lspId);
        safeIds = (members ?? [])
          .map((m) => String(m.assessor_id))
          .filter((id) => isUuid(id));
        memberSet = new Set(safeIds);

        if (safeIds.length > 0) {
          const { data: profiles } = await supabase
            .from("assessors")
            .select("id, full_name")
            .in("id", safeIds);
          for (const p of profiles ?? []) {
            actorNameMap.set(String(p.id), String(p.full_name));
          }
        }
      }

      let query = supabase
        .from("audit_log")
        .select("id, lsp_id, actor_id, action, resource, resource_id, after_summary, correlation_id, created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);

      if (lspId) {
        if (safeIds.length > 0) {
          query = query.or(`lsp_id.eq.${lspId},and(lsp_id.is.null,actor_id.in.(${safeIds.join(",")}))`);
        } else {
          query = query.eq("lsp_id", lspId);
        }
      }

      if (typeof beforeId === "number" && Number.isFinite(beforeId) && beforeId > 0) {
        query = query.lt("id", Math.floor(beforeId));
      }

      const { data } = await query;
      const seenIds = new Set<number>();

      return (data ?? [])
        .filter((r) => {
          const id = Number(r.id);
          if (seenIds.has(id)) return false;
          seenIds.add(id);
          return (
            !lspId ||
            r.lsp_id === lspId ||
            (r.lsp_id === null && r.actor_id !== null && memberSet.has(String(r.actor_id)))
          );
        })
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
    },
  });
}

export async function listAuditLogsForResource(
  userId: string,
  lspId: string,
  resource: string,
  resourceId: string,
  limit = 30,
): Promise<AuditLogViewRow[]> {
  return runRepositoryDualPath({
    userId,
    label: "AuditRepository.listAuditLogsForResource",
    drizzle: async (tx) => {
      const members = await tx
        .select({ assessorId: lspMemberships.assessorId })
        .from(lspMemberships)
        .where(eq(lspMemberships.lspId, lspId));
      const memberIds = members.map((m) => m.assessorId);
      const actorRows =
        memberIds.length > 0
          ? await tx
              .select({ id: assessors.id, fullName: assessors.fullName })
              .from(assessors)
              .where(inArray(assessors.id, memberIds))
          : [];

      const tenantScope =
        memberIds.length > 0
          ? or(
              eq(auditLog.lspId, lspId),
              and(isNull(auditLog.lspId), inArray(auditLog.actorId, memberIds)),
            )
          : eq(auditLog.lspId, lspId);

      const rows = await tx
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.resource, resource),
            eq(auditLog.resourceId, resourceId),
            tenantScope,
          ),
        )
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(limit);

      const memberSet = new Set(memberIds);
      const actorNameMap = new Map(actorRows.map((a) => [a.id, a.fullName]));
      const seenIds = new Set<number>();

      return rows
        .filter((r) => {
          if (seenIds.has(r.id)) return false;
          seenIds.add(r.id);
          return (
            r.lspId === lspId ||
            (r.lspId === null && r.actorId !== null && memberSet.has(r.actorId))
          );
        })
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
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data: members } = await supabase
        .from("lsp_memberships")
        .select("assessor_id")
        .eq("lsp_id", lspId);
      const safeIds = (members ?? [])
        .map((m) => String(m.assessor_id))
        .filter((id) => isUuid(id));
      const memberSet = new Set(safeIds);
      const actorNameMap = new Map<string, string>();

      if (safeIds.length > 0) {
        const { data: profiles } = await supabase
          .from("assessors")
          .select("id, full_name")
          .in("id", safeIds);
        for (const p of profiles ?? []) {
          actorNameMap.set(String(p.id), String(p.full_name));
        }
      }

      let query = supabase
        .from("audit_log")
        .select("id, lsp_id, actor_id, action, resource, resource_id, after_summary, correlation_id, created_at")
        .eq("resource", resource)
        .eq("resource_id", resourceId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);

      if (safeIds.length > 0) {
        query = query.or(`lsp_id.eq.${lspId},and(lsp_id.is.null,actor_id.in.(${safeIds.join(",")}))`);
      } else {
        query = query.eq("lsp_id", lspId);
      }

      const { data } = await query;
      const seenIds = new Set<number>();

      return (data ?? [])
        .filter((r) => {
          const id = Number(r.id);
          if (seenIds.has(id)) return false;
          seenIds.add(id);
          return (
            r.lsp_id === lspId ||
            (r.lsp_id === null && r.actor_id !== null && memberSet.has(String(r.actor_id)))
          );
        })
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
    },
  });
}
