import Link from "next/link";
import { getUser } from "@/lib/auth/get-session";
import {
  listBatchesForUser,
  listBatchResourceCountsForUser,
} from "@/repositories/batches.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { CreateBatchPanel } from "./_components/create-batch-panel";

export const metadata = {
  title: "Batch Asesmen — AsesorKompetensi",
};

export default async function BatchesPage() {
  const user = await getUser();
  const [batches, schemes, resourceCounts] = user
    ? await Promise.all([
        listBatchesForUser(user.id),
        listSchemes(user.id),
        listBatchResourceCountsForUser(user.id),
      ])
    : [[], [], new Map()];
  const schemeById = new Map(schemes.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Batch Asesmen
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelompok uji kompetensi yang terhubung ke folder Google Drive TUK/LSP.
          </p>
        </div>
        <CreateBatchPanel
          schemes={schemes.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
        />
      </div>

      {batches.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-2">
          <h3 className="text-base font-semibold text-slate-900">
            Belum Ada Batch Terdaftar
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Pastikan skema sudah didaftarkan di Pengaturan &rarr; Skema, lalu buat batch baru di atas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((b) => {
            const scheme = b.schemeId ? schemeById.get(b.schemeId) : undefined;
            const counts = resourceCounts.get(b.id) ?? { assesseeCount: 0, fileCount: 0 };
            return (
              <Link
                key={b.id}
                href={`/batches/${b.id}`}
                className="glass-card rounded-2xl p-5 hover:border-teal-500 transition-all block min-w-0 overflow-hidden space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 leading-snug break-words min-w-0">
                    {b.name}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    {b.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="truncate" title={scheme ? `${scheme.code} — ${scheme.name}` : undefined}>
                    Skema: <strong className="text-slate-800">{scheme ? `${scheme.code} — ${scheme.name}` : "-"}</strong>
                  </div>
                  <div>
                    Asesi: <strong className="text-slate-800">{counts.assesseeCount}</strong> · Berkas:{" "}
                    <strong className="text-slate-800">{counts.fileCount}</strong>
                  </div>
                  <div>TUK: {b.tukName || "-"} ({b.tukType || "sewaktu"})</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
