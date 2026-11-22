import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { formatAuditSummary, resolveAuditResourceHref } from "@/lib/audit/job-audit";
import { getUser } from "@/lib/auth/get-session";
import { resolveAuthorizedLsp } from "@/lib/auth/get-role";
import { listAuditLogsForUser } from "@/repositories/audit.repository";
import { RefreshAuditButton } from "./_components/refresh-audit-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log Audit Aktivitas — AsesorKompetensi",
};

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<{ beforeId?: string; limit?: string }>;
}) {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const params = searchParams ? await searchParams : {};
  const beforeId = parsePositiveInt(params.beforeId);
  const parsedLimit = parsePositiveInt(params.limit);
  const pageLimit = Math.min(200, Math.max(10, parsedLimit ?? 100));

  const roleCheck = await resolveAuthorizedLsp(user.id, ["lsp_admin"]);

  const logs =
    roleCheck.allowed && roleCheck.lspId
      ? await listAuditLogsForUser(user.id, roleCheck.lspId, pageLimit, beforeId)
      : [];
  const lastLogId = logs.length > 0 ? logs[logs.length - 1]?.id : undefined;
  const hasMoreLogs = logs.length === pageLimit && typeof lastLogId === "number";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/settings" className="text-xs text-teal-700 hover:underline">
            &larr; Kembali ke Pengaturan
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <ShieldCheck className="w-6 h-6 text-teal-700" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Log Audit Aktivitas (Append-Only)
            </h1>
            {roleCheck.allowed && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                Menampilkan {logs.length} entri
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Rekaman jejak audit keamanan dan perubahan data penting pada LSP Anda (khusus Admin LSP).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/v1/audit/export"
            className="px-3.5 py-2 rounded-xl bg-teal-700 text-white hover:bg-teal-800 text-xs font-medium inline-flex items-center gap-1.5"
          >
            Ekspor XLSX
          </a>
          <RefreshAuditButton hasBeforeId={Boolean(beforeId)} />
        </div>
      </div>

      {!roleCheck.allowed ? (
        <div className="glass-card rounded-2xl p-8 text-sm text-amber-800 bg-amber-50/70 border-amber-200">
          Hanya pengguna dengan peran <strong>Admin LSP</strong> yang berwenang melihat riwayat log audit.
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-slate-500 space-y-3">
          <p>
            {beforeId
              ? "Tidak ada entri log audit yang lebih lama pada halaman ini."
              : "Belum ada catatan log audit yang terekam untuk LSP ini."}
          </p>
          {beforeId && (
            <Link
              href="/settings/audit"
              className="inline-flex items-center px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700"
            >
              &larr; Kembali ke Entri Terbaru
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
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
          {(beforeId || hasMoreLogs) && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div>
                {beforeId && (
                  <Link
                    href={`/settings/audit?limit=${pageLimit}`}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5"
                  >
                    &larr; Kembali ke Entri Terbaru
                  </Link>
                )}
              </div>
              <div>
                {hasMoreLogs && lastLogId && (
                  <Link
                    href={`/settings/audit?beforeId=${lastLogId}&limit=${pageLimit}`}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5"
                  >
                    Muat Entri Lebih Lama &rarr;
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
