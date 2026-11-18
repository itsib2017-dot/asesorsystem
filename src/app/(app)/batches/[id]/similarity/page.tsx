import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { getBatchById } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { listSimilarityPairsByBatch } from "@/repositories/assessment.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { renderCombinedWrittenReportMarkdown } from "@/services/similarity";

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
  const batch = await getBatchById(user.id, batchId);
  if (!batch) return notFound();

  const [pairs, assessees, schemes] = await Promise.all([
    listSimilarityPairsByBatch(user.id, batchId),
    listAssesseesByBatch(user.id, batchId),
    listSchemes(user.id, batch.lspId),
  ]);
  const scheme = schemes.find((s) => s.id === batch.schemeId);
  const nameMap = new Map(assessees.map((a) => [a.id, a.displayName]));

  const combinedMd = renderCombinedWrittenReportMarkdown({
    batchName: batch.name,
    schemeName: scheme
      ? `${scheme.code} — ${scheme.name}`
      : batch.tukName || "Skema Terdaftar",
    assessees: assessees.map((a) => ({
      assesseeId: a.id,
      realName: a.displayName,
      verdicts: [],
      ringkasanKesalahan: [],
      plagiarismStatus: "Bersih",
      plagiarismReasoning: "Menunggu hasil pemeriksaan tertulis.",
    })),
    flaggedPairs: pairs.map((p: Record<string, unknown>) => {
      const idA = String(p.assesseeAId ?? p.assessee_a_id ?? "");
      const idB = String(p.assesseeBId ?? p.assessee_b_id ?? "");
      return {
        assesseeAId: idA,
        assesseeAName: nameMap.get(idA) ?? idA,
        assesseeBId: idB,
        assesseeBName: nameMap.get(idB) ?? idB,
        jaccardScore: Number(p.jaccardScore ?? p.jaccard_score ?? 0),
        tfidfCosine: Number(p.tfidfCosine ?? p.tfidf_cosine ?? 0),
        sharedSpans: [],
        verdict: String(p.verdict ?? "perlu_ditinjau"),
      };
    }),
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/batches/${batchId}`} className="text-xs text-teal-700 hover:underline">
          &larr; Kembali ke Batch
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
          Analisis Kemiripan &amp; Laporan Gabungan ({batch.name})
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Skor kemiripan hanyalah indikator peninjauan bagi asesor (flag only — bukan vonis otomatis).
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Pasangan Kemiripan Terdeteksi ({pairs.length})
        </div>
        {pairs.length === 0 ? (
          <p className="text-xs text-slate-500">
            Belum ada pasangan kemiripan yang melebihi ambang batas konfigurasi pada batch ini.
          </p>
        ) : (
          <div className="space-y-3">
            {pairs.map((p: Record<string, unknown>, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 text-xs flex justify-between items-center">
                <div>
                  <strong>{nameMap.get(String(p.assesseeAId ?? p.assessee_a_id)) ?? "-"}</strong>
                  {" vs "}
                  <strong>{nameMap.get(String(p.assesseeBId ?? p.assessee_b_id)) ?? "-"}</strong>
                </div>
                <div className="font-mono">
                  Jaccard: {String(p.jaccardScore ?? p.jaccard_score)} | Cosine:{" "}
                  {String(p.tfidfCosine ?? p.tfidf_cosine)} | Status: {String(p.verdict)}
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
