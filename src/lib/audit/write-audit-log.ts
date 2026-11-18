import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { insertAuditLogRecord } from "@/repositories/audit.repository";

export interface AuditLogEntry {
  lsp_id?: string | null;
  actor_id?: string | null;
  action: string;
  resource: string;
  resource_id?: string | null;
  before_summary?: Record<string, unknown> | null;
  after_summary?: Record<string, unknown> | null;
  break_glass_reason?: string | null;
  correlation_id?: string;
  ip?: string | null;
  user_agent?: string | null;
}

/**
 * Appends an entry to the append-only public.audit_log table via repository layer.
 * Never throws to the caller: failures are safely logged to stderr with correlation ID.
 */
export async function writeAuditLog(
  entry: AuditLogEntry,
  supabase: SupabaseClient,
): Promise<string> {
  const correlationId = entry.correlation_id || randomUUID();

  try {
    let resolvedLspId = entry.lsp_id ?? null;
    if (!resolvedLspId && entry.actor_id) {
      try {
        const memQuery = supabase.from("lsp_memberships");
        if (memQuery && typeof memQuery.select === "function") {
          const { data: mem } = await memQuery
            .select("lsp_id")
            .eq("assessor_id", entry.actor_id)
            .limit(1)
            .maybeSingle();
          resolvedLspId = (mem?.lsp_id as string | undefined) ?? null;
        }
      } catch {
        resolvedLspId = null;
      }
    }

    const payload = {
      lsp_id: resolvedLspId,
      actor_id: entry.actor_id ?? null,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resource_id ?? null,
      before_summary: entry.before_summary ?? null,
      after_summary: entry.after_summary ?? null,
      break_glass_reason: entry.break_glass_reason ?? null,
      correlation_id: correlationId,
      ip: entry.ip ?? null,
      user_agent: entry.user_agent ?? null,
    };

    const { error } = await insertAuditLogRecord(payload, supabase);
    if (error) {
      console.error(
        `[Audit Log Error][${correlationId}] Failed to record audit log:`,
        error.message,
      );
    }
  } catch (err) {
    console.error(
      `[Audit Log Exception][${correlationId}] Unexpected error while recording audit log:`,
      err,
    );
  }

  return correlationId;
}
