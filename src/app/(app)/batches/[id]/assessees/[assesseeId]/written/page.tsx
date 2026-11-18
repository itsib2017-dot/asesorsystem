import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound, ShieldAlert, CheckCircle2 } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { getAssesseeById } from "@/repositories/assessees.repository";
import { getLatestWrittenGrading } from "@/repositories/assessment.repository";

export const metadata = {
  title: "Penilaian Tertulis FR.IA.06 — AsesorKompetensi",
};

export default async function WrittenGradingPage({
  params,
}: {
  params: Promise<{ id: string; assesseeId: string }>;
}) {
  const user = await getUser();
  if (!user) return notFound();

  const { id: batchId, assesseeId } = await params;
  const assessee = await getAssesseeById(user.id, assesseeId);
  if (!assessee) return notFound();

  const grading = await getLatestWrittenGrading(user.id, assesseeId);
  const itemVerdicts = Array.isArray(grading?.item_verdicts ?? grading?.itemVerdicts)
    ? ((grading?.item_verdicts ?? grading?.itemVerdicts) as Array<Record<string, unknown>>)
    : [];
  const errorSummary = Array.isArray(grading?.error_summary ?? grading?.errorSummary)
    ? ((grading?.error_summary ?? grading?.errorSummary) as number[])
    : [];
  const vatmRecs = Array.isArray(grading?.vatm_unit_recommendations ?? grading?.vatmUnitRecommendations)
    ? ((grading?.vatm_unit_recommendations ?? grading?.vatmUnitRecommendations) as Array<Record<string, unknown>>)
    : [];
  const plagiarism = (grading?.plagiarism_report ?? grading?.plagiarismReport) as
    | { status?: string; reasoning?: string }
    | undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/batches/${batchId}/assessees/${assesseeId}`}
          className="text-xs text-teal-700 hover:underline"
        >
          &larr; Kembali ke Detail Asesi
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
          Penilaian Tertulis FR.IA.06 ({assessee.displayName})
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Putusan per soal (Benar / Sebagian / Salah), Ringkasan Kesalahan, dan rekomendasi K / BK berbasis VATM (tanpa ambang persentase).
        </p>
      </div>

      {/* Encrypted 06B Key Unlock Notice (D12) */}
      <div className="glass-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 border-slate-200">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Kunci Jawaban 06B (Dukungan Terenkripsi &amp; Plain OOXML)
            </h2>
            <p className="text-xs text-slate-500">
              Kata sandi untuk file kunci terenkripsi diproses hanya di memori worker saat dekripsi dan tidak pernah disimpan atau dicatat.
            </p>
          </div>
        </div>
      </div>

      {/* Ringkasan Kesalahan & Qualitative Plagiarism */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ringkasan Kesalahan (No. Soal Salah / Sebagian)
          </div>
          <div className="text-lg font-bold text-slate-900">
            {errorSummary.length > 0
              ? `Nomor: ${errorSummary.join(", ")}`
              : grading
                ? "Tidak ada kesalahan"
                : "Belum dinilai"}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Analisis Indikasi Plagiarisme (Kualitatif Terpisah)
          </div>
          <div className="flex items-center gap-2">
            {plagiarism?.status === "Waspada" ? (
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            )}
            <span className="text-base font-bold text-slate-900">
              {plagiarism?.status ?? "Belum dianalisis"}
            </span>
          </div>
          {plagiarism?.reasoning && (
            <p className="text-xs text-slate-600">{plagiarism.reasoning}</p>
          )}
        </div>
      </div>

      {/* Per-Question Verdicts */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Rincian Jawaban Per Nomor Soal (Rekomendasi AI)
        </h2>
        {itemVerdicts.length === 0 ? (
          <p className="text-xs text-slate-500">
            Belum ada hasil koreksi tes tertulis untuk asesi ini.
          </p>
        ) : (
          <div className="space-y-3">
            {itemVerdicts.map((item, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">
                    Soal #{String(item.questionNo ?? idx + 1)}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-slate-300">
                    {String(item.verdict ?? "-")}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                    <div className="font-semibold text-slate-500 mb-1">Kutipan Kunci Master:</div>
                    <p className="text-slate-800">{String(item.masterSpan ?? "-")}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                    <div className="font-semibold text-slate-500 mb-1">Kutipan Jawaban Asesi:</div>
                    <p className="text-slate-800">{String(item.studentSpan ?? "-")}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-700">
                  <strong>Penjelasan: </strong>
                  {String(item.explanation ?? "-")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VATM Unit Recommendations */}
      {vatmRecs.length > 0 && (
        <div className="glass-card rounded-2xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            Rekomendasi Roll-Up VATM Per Unit (D16)
          </h2>
          {vatmRecs.map((v, i) => (
            <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex justify-between gap-4">
              <div>
                <div className="font-semibold text-slate-900">
                  {String(v.unitCode)} — {String(v.unitTitle)}
                </div>
                <p className="text-slate-600 mt-0.5">{String(v.reasoning)}</p>
              </div>
              <span className="font-bold px-3 py-1 rounded-lg bg-white border border-slate-300 h-fit">
                {String(v.recommendation)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
