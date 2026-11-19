import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { resolveAuditResourceHref } from "@/lib/audit/job-audit";
import { getUser } from "@/lib/auth/get-session";
import { resolveAuthorizedLsp } from "@/lib/auth/get-role";
import { listAuditLogsForUser } from "@/repositories/audit.repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log Audit Aktivitas — AsesorKompetensi",
};

function formatAuditSummary(summary: Record<string, unknown> | null): string {
  if (!summary) return "-";
  const preferredKeys = [
    "name",
    "code",
    "type",
    "status",
    "scannedFiles",
    "attempts",
    "batchId",
    "provider",
    "model",
    "mimeType",
    "error",
  ];
  const parts: string[] = [];
  for (const key of preferredKeys) {
    if (summary[key] !== undefined && summary[key] !== null && summary[key] !== "") {
      parts.push(`${key}: ${String(summary[key])}`);
    }
  }
  if (parts.length > 0) return parts.join(" · ");
  const entries = Object.entries(summary).slice(0, 3);
  return entries.length > 0
    ? entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")
    : "-";
}

export default async function AuditLogPage() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const roleCheck = await resolveAuthorizedLsp(user.id, ["lsp_admin"]);

  const logs =
    roleCheck.allowed && roleCheck.lspId
      ? await listAuditLogsForUser(user.id, roleCheck.lspId, 50)
      : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/settings" className="text-xs text-teal-700 hover:underline">
          &larr; Kembali ke Pengaturan
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <ShieldCheck className="w-6 h-6 text-teal-700" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Log Audit Aktivitas (Append-Only)
          </h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Rekaman jejak audit keamanan dan perubahan data penting pada LSP Anda (khusus Admin LSP).
        </p>
      </div>

      {!roleCheck.allowed ? (
        <div className="glass-card rounded-2xl p-8 text-sm text-amber-800 bg-amber-50/70 border-amber-200">
          Hanya pengguna dengan peran <strong>Admin LSP</strong> yang berwenang melihat riwayat log audit.
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-slate-500">
          Belum ada catatan log audit yang terekam untuk LSP ini.
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-x-auto">
          <table className="w-full text-xs text-left table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200 uppercase text-slate-600">
              <tr>
                <th className="py-3 px-3 w-36">Waktu</th>
                <th className="py-3 px-3 w-32">Aktor</th>
                <th className="py-3 px-3 w-40">Aksi</th>
                <th className="py-3 px-3 w-28">Resource</th>
                <th className="py-3 px-3 w-44">Resource ID</th>
                <th className="py-3 px-3">Ringkasan / Correlation ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((row) => {
                const resourceHref = resolveAuditResourceHref(row);
                return (
                  <tr key={row.id} className="hover:bg-slate-50/60 align-top">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 break-words">
                      {row.createdAt}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-700 break-words" title={row.actorId || undefined}>
                      <div className="font-medium text-slate-900">
                        {row.actorName || "Sistem"}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {row.actorId ? row.actorId.slice(0, 8) : "-"}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 break-words">
                      {row.action}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 break-words">
                      {row.resource}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 break-all">
                      {resourceHref && row.resourceId ? (
                        <Link
                          href={resourceHref}
                          className="text-teal-700 hover:underline font-medium"
                        >
                          {row.resourceId}
                        </Link>
                      ) : (
                        row.resourceId || "-"
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-600 break-words space-y-0.5">
                      <div>{formatAuditSummary(row.afterSummary)}</div>
                      <div className="font-mono text-[10px] text-slate-400 break-all">
                        corr: {row.correlationId}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
