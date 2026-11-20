import { getUser } from "@/lib/auth/get-session";
import { resolveAuthorizedLsp } from "@/lib/auth/get-role";
import { apiError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listAuditLogsForUser } from "@/repositories/audit.repository";
import { generateTabularXlsx } from "@/services/export";

export const dynamic = "force-dynamic";

const MAX_EXPORT_ROWS = 2000;

export async function GET() {
  const user = await getUser();
  if (!user) return apiError("UNAUTHORIZED", "Sesi tidak valid.");

  const roleCheck = await resolveAuthorizedLsp(user.id, ["lsp_admin"]);
  if (!roleCheck.allowed || !roleCheck.lspId) {
    return apiError("FORBIDDEN", "Hanya Admin LSP yang dapat mengekspor log audit.");
  }

  const logs = await listAuditLogsForUser(user.id, roleCheck.lspId, MAX_EXPORT_ROWS);
  const buffer = await generateTabularXlsx(
    "Audit Log",
    ["ID", "Waktu", "Aktor", "Aksi", "Resource", "Resource ID", "Ringkasan", "Correlation ID"],
    logs.map((row) => [
      row.id,
      row.createdAt,
      row.actorName ?? row.actorId ?? "Sistem",
      row.action,
      row.resource,
      row.resourceId ?? "",
      JSON.stringify(row.afterSummary ?? {}),
      row.correlationId,
    ]),
  );

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: roleCheck.lspId,
        actor_id: user.id,
        action: "audit.export.xlsx",
        resource: "audit_log",
        resource_id: null,
        after_summary: { rowCount: logs.length },
      },
      supabase,
    );
  } catch {
    // non-fatal: export must still complete
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="audit-log.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
