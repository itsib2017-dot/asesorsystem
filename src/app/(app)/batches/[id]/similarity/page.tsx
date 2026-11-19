import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, FileText } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { loadBatchSimilarityReportData } from "@/lib/similarity/load-batch-similarity";
import { SimilarityRunTrigger } from "./similarity-run-trigger";

export const metadata = {
  title: "Laporan Kemiripan & Gabungan — AsesorKompetensi",
};

export default async function SimilarityReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  if (!user) return notFound();

  const { id: batchId } = await params;
  const data = await loadBatchSimilarityReportData(user.id, batchId);
  if (!data) return notFound();

  const {
    batch,
    schemeName,
    thresholds,
    thresholdsUncalibrated,
    thresholdSourceLabel,
    flaggedPairs,
    combinedMd,
  } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/batches/${batchId}`} className="text-xs text-teal-700 hover:underline">
            &larr; Kembali ke Batch
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Analisis Kemiripan &amp; Laporan Gabungan ({batch.name})
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Skema: <strong>{schemeName}</strong>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Skor kemiripan hanyalah indikator peninjauan bagi asesor (flag only — bukan vonis otomatis).
          </p>
        </div>

        <a
          href={`/api/v1/batches/${batchId}/similarity/export?format=docx`}
          className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-xs font-medium text-white shadow-sm inline-flex items-center gap-2 shrink-0"
        >
          <FileText className="w-4 h-4" />
          Ekspor Laporan Gabungan (.docx)
        </a>
      </div>

      <SimilarityRunTrigger batchId={batchId} />

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Pasangan Kemiripan Terdeteksi ({flaggedPairs.length})
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700">
              Ambang batas numerik: Exact &ge; {thresholds.exact.toFixed(2)} ({Math.round(thresholds.exact * 100)}%) ·
              Near &ge; {thresholds.near.toFixed(2)} ({Math.round(thresholds.near * 100)}%) ·
              Parsial &ge; {thresholds.partial.toFixed(2)} ({Math.round(thresholds.partial * 100)}%)
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-700">
              Sumber: {thresholdSourceLabel}
            </span>
            {thresholdsUncalibrated && (
              <span
                className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-800"
                title="Ambang batas kemiripan bawaan belum dikalibrasi secara empiris oleh administrator LSP"
              >
                Sementara / Belum Dikalibrasi (D19 / OQ-08)
              </span>
            )}
          </div>
        </div>
        {flaggedPairs.length === 0 ? (
          <p className="text-xs text-slate-500">
            Belum ada pasangan kemiripan yang melebihi ambang batas deteksi (Parsial &ge;{" "}
            {thresholds.partial.toFixed(2)} / Near &ge; {thresholds.near.toFixed(2)} / Exact &ge;{" "}
            {thresholds.exact.toFixed(2)}) pada batch ini.
          </p>
        ) : (
          <div className="space-y-3">
            {flaggedPairs.map((p, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 text-xs flex justify-between items-center">
                <div>
                  <strong>{p.assesseeAName || "-"}</strong>
                  {" vs "}
                  <strong>{p.assesseeBName || "-"}</strong>
                </div>
                <div className="font-mono">
                  Jaccard: {p.jaccardScore} | Cosine: {p.tfidfCosine} | Status: {p.verdict}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Pratinjau Laporan Gabungan Markdown (Bahasa Indonesia)
        </h2>
        <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 text-xs overflow-x-auto font-mono whitespace-pre-wrap">
          {combinedMd}
        </pre>
      </div>
    </div>
  );
}
