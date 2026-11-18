import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { requireLspRole } from "@/lib/auth/get-role";
import { listUserMemberships } from "@/repositories/auth.repository";
import { listAuditLogsForUser } from "@/repositories/audit.repository";

export const metadata = {
  title: "Log Audit Aktivitas — AsesorKompetensi",
};

export default async function AuditLogPage() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const memberships = await listUserMemberships(user.id);
  const adminMembership = memberships.find((m) => m.role === "lsp_admin");
  const roleCheck = adminMembership
    ? await requireLspRole(adminMembership.lspId, user.id, ["lsp_admin"])
    : { allowed: false, role: null };

  const logs =
    adminMembership && roleCheck.allowed
      ? await listAuditLogsForUser(user.id, adminMembership.lspId, 50)
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
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 uppercase text-slate-600">
              <tr>
                <th className="py-3 px-4">Waktu (UTC)</th>
                <th className="py-3 px-4">Aksi</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">Resource ID</th>
                <th className="py-3 px-4">Correlation ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                    {row.createdAt}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">
                    {row.action}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-700">
                    {row.resource}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">
                    {row.resourceId || "-"}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-400">
                    {row.correlationId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
