import Link from "next/link";
import {
  FolderKanban,
  FileCheck2,
  ShieldAlert,
  FileSignature,
  ArrowRight,
  Cpu,
} from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { listBatchesForUser } from "@/repositories/batches.repository";
import { getActiveSignature } from "@/repositories/signatures.repository";
import { getLatestProviderConfigForAssessor } from "@/repositories/provider.repository";
import { StatsCard } from "@/components/dashboard/stats-card";

export const metadata = {
  title: "Dashboard Asesor — AsesorKompetensi",
};

export default async function DashboardPage() {
  const user = await getUser();
  const batches = user ? await listBatchesForUser(user.id) : [];
  const activeSignature = user ? await getActiveSignature(user.id) : null;
  const providerCfg = user ? await getLatestProviderConfigForAssessor(user.id) : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard Asesmen
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ringkasan batch aktif, kelengkapan dokumen, dan keputusan yang menunggu konfirmasi Anda.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/settings/provider"
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-sm font-medium text-slate-700 inline-flex items-center gap-2 transition-colors"
          >
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>Penyedia AI</span>
          </Link>
          <Link
            href="/batches"
            className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-sm font-medium text-white shadow-sm inline-flex items-center gap-2 transition-colors"
          >
            <span>+ Buat Batch Baru</span>
          </Link>
        </div>
      </div>

      {/* D20 Glassmorphism Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Batch Aktif"
          value={batches.length}
          subtitle="Terdaftar di LSP Anda"
          trend="up"
          trendLabel={batches.length > 0 ? "Siap diproses" : "Belum ada batch"}
          accent="blue"
          icon={<FolderKanban className="w-5 h-5" />}
        />
        <StatsCard
          title="Penyedia AI (BYOK)"
          value={providerCfg ? providerCfg.provider : "Belum Diatur"}
          subtitle={providerCfg ? providerCfg.model : "Atur kunci API Anda"}
          trend={providerCfg ? "up" : "down"}
          trendLabel={providerCfg ? "Terenkripsi AES-GCM" : "Perlu konfigurasi"}
          accent="teal"
          icon={<Cpu className="w-5 h-5" />}
        />
        <StatsCard
          title="Tanda Tangan Digital"
          value={activeSignature ? "Aktif" : "Belum Ada"}
          subtitle={activeSignature ? "Siap untuk AK.05" : "Wajib sebelum ekspor"}
          trend={activeSignature ? "up" : "down"}
          trendLabel={activeSignature ? "Terverifikasi" : "Unggah sekarang"}
          accent={activeSignature ? "emerald" : "amber"}
          icon={<FileSignature className="w-5 h-5" />}
        />
        <StatsCard
          title="Aturan Keputusan"
          value="VATM (K / BK)"
          subtitle="Valid, Asli, Terkini, Memadai"
          trend="up"
          trendLabel="Otoritas KTP Aktif"
          accent="emerald"
          icon={<FileCheck2 className="w-5 h-5" />}
        />
      </div>

      {/* 2-Column Main Area: 3-column Batch Grid + Right-hand "Perlu keputusan Anda" panel (D20) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Daftar Batch Asesmen
            </h2>
            <Link
              href="/batches"
              className="text-xs font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
            >
              Lihat semua <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {batches.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center space-y-3">
              <p className="text-sm text-slate-600">
                Belum ada batch yang dibuat. Pilih skema terdaftar, tempel link folder Google Drive, dan mulai pemindaian berkas.
              </p>
              <Link
                href="/batches"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium"
              >
                Mulai Buat Batch Pertama
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {batches.slice(0, 6).map((b) => (
                <Link
                  key={b.id}
                  href={`/batches/${b.id}`}
                  className="glass-card rounded-2xl p-5 hover:border-teal-500/50 transition-all block"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{b.name}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    TUK: {b.tukName || "Belum ditentukan"} ({b.tukType || "sewaktu"})
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right-Hand Panel: Perlu Keputusan Anda (D20 adaptation of Collections panel) */}
        <div className="glass-card rounded-2xl p-6 space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Perlu Keputusan Anda
            </h2>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>

          <ul className="space-y-3 text-sm">
            {!providerCfg && (
              <li className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-2">
                <span className="text-xs text-amber-900">
                  Konfigurasi Penyedia AI (BYOK) belum diisi
                </span>
                <Link
                  href="/settings/provider"
                  className="text-xs font-semibold text-amber-800 underline shrink-0"
                >
                  Atur
                </Link>
              </li>
            )}
            {!activeSignature && (
              <li className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-2">
                <span className="text-xs text-amber-900">
                  Unggah tanda tangan asesor untuk membuka kunci FR.AK.05
                </span>
                <Link
                  href="/settings/profile"
                  className="text-xs font-semibold text-amber-800 underline shrink-0"
                >
                  Unggah
                </Link>
              </li>
            )}
            <li className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-700">
              <span>Total batch menunggu asesmen</span>
              <span className="font-bold text-slate-900">{batches.length}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
