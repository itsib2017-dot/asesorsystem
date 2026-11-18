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
import {
  listBatchesForUser,
  listBatchResourceCountsForUser,
} from "@/repositories/batches.repository";
import { listJobsForUser } from "@/repositories/jobs.repository";
import { getActiveSignature } from "@/repositories/signatures.repository";
import { getLatestProviderConfigForAssessor } from "@/repositories/provider.repository";
import { StatsCard } from "@/components/dashboard/stats-card";

export const metadata = {
  title: "Dashboard Asesor — AsesorKompetensi",
};

export default async function DashboardPage() {
  const user = await getUser();
  const [batches, batchCountsMap, recentJobs, activeSignature, providerCfg] = user
    ? await Promise.all([
        listBatchesForUser(user.id),
        listBatchResourceCountsForUser(user.id),
        listJobsForUser(user.id, 100),
        getActiveSignature(user.id),
        getLatestProviderConfigForAssessor(user.id),
      ])
    : [[], new Map(), [], null, null];

  const batchJobMap = new Map(
    batches.map((b) => [
      b.id,
      recentJobs.find(
        (j) => String(j.payload?.batchId ?? "") === b.id && j.type === "drive_scan",
      ) ?? null,
    ]),
  );

  const readyBatchCount = batches.filter((b) => {
    const counts = batchCountsMap.get(b.id) ?? { assesseeCount: 0, fileCount: 0 };
    return (
      batchJobMap.get(b.id)?.status === "done" &&
      (counts.assesseeCount > 0 || counts.fileCount > 0)
    );
  }).length;
  const pendingOrEmptyCount = batches.length - readyBatchCount;

  const batchTrendLabel =
    batches.length === 0
      ? "Belum ada batch"
      : readyBatchCount === 0
        ? "Perlu pemindaian Drive"
        : pendingOrEmptyCount === 0
          ? "Semua siap diproses"
          : `${readyBatchCount} siap · ${pendingOrEmptyCount} belum siap`;

  const batchTrend: "up" | "down" | "neutral" =
    batches.length === 0 ? "neutral" : readyBatchCount > 0 ? "up" : "down";

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
          title="Batch Siap Asesmen"
          value={readyBatchCount}
          subtitle={
            batches.length === 0
              ? "Terdaftar di LSP Anda"
              : `Dari ${batches.length} batch terdaftar di LSP`
          }
          trend={batchTrend}
          trendLabel={batchTrendLabel}
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
              {batches.slice(0, 6).map((b) => {
                const scanJob = batchJobMap.get(b.id) ?? null;
                const counts = batchCountsMap.get(b.id) ?? {
                  assesseeCount: 0,
                  fileCount: 0,
                };
                const isReady =
                  scanJob?.status === "done" &&
                  (counts.assesseeCount > 0 || counts.fileCount > 0);
                const scanBadge = isReady
                  ? {
                      label: `Siap (${counts.assesseeCount} asesi · ${counts.fileCount} berkas)`,
                      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    }
                  : scanJob?.status === "failed"
                    ? {
                        label: "Pindai gagal (0 berkas)",
                        cls: "bg-rose-50 text-rose-700 border-rose-200",
                      }
                    : {
                        label: `Perlu pindai (${counts.assesseeCount} · ${counts.fileCount})`,
                        cls: "bg-amber-50 text-amber-800 border-amber-200",
                      };

                return (
                  <Link
                    key={b.id}
                    href={`/batches/${b.id}`}
                    className="glass-card rounded-2xl p-5 hover:border-teal-500/50 transition-all block"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{b.name}</h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${scanBadge.cls}`}
                        >
                          {scanBadge.label}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {b.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      TUK: {b.tukName || "Belum ditentukan"} ({b.tukType || "sewaktu"})
                    </p>
                  </Link>
                );
              })}
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
              <span>Batch siap asesmen</span>
              <span className="font-bold text-emerald-700">{readyBatchCount}</span>
            </li>
            <li className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-700">
              <span>Batch kosong / perlu pindai ulang</span>
              <span className="font-bold text-amber-700">{pendingOrEmptyCount}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
