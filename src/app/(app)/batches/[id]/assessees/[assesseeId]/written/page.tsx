import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound, ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { getLatestWrittenGrading } from "@/repositories/assessment.repository";
import { listDriveFilesForBatch } from "@/repositories/batches.repository";
import { pickLatestDriveFile } from "@/services/drive-revisions";
import { resolveBatchActiveMasterKey } from "@/lib/written/master-key";
import { Ia06cBlankoPreview } from "@/components/forms/ia06c-blanko-preview";
import { loadAssesseeCommonFormMeta } from "@/lib/forms/load-assessee-page-data";
import {
  buildIa06cAiProposals,
  buildIa06cPayload,
  extractOfficial06cAssessment,
  hasSavedOfficial06cAssessment,
  resolveSchemeWrittenQuestions,
} from "@/lib/forms/assessee-forms";
import { Ia06cAssessmentForm } from "./_components/ia06c-assessment-form";
import { WrittenKeyForm } from "./_components/written-key-form";

export const maxDuration = 300;

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
  const common = await loadAssesseeCommonFormMeta({
    userId: user.id,
    userEmail: user.email,
    batchId,
    assesseeId,
  });
  if (!common) return notFound();
  const { assessee } = common;

  const [grading, batchFiles] = await Promise.all([
    getLatestWrittenGrading(user.id, assesseeId),
    listDriveFilesForBatch(user.id, batchId),
  ]);

  const savedOfficial06c = extractOfficial06cAssessment(
    grading as Record<string, unknown> | null,
  );
  const hasSavedOfficial06c = hasSavedOfficial06cAssessment(savedOfficial06c);
  const aiProposal06c = buildIa06cAiProposals({
    scheme: common.scheme,
    writtenGrading: grading as Record<string, unknown> | null,
  });

  const ia06cPayload = buildIa06cPayload({
    scheme: common.scheme,
    schemeTitle: common.schemeTitle,
    schemeNumber: common.schemeNumber,
    tukType: common.batch.tukType,
    assessorName: common.assessorName,
    assessorRegNo: common.assessorRegNo,
    assesseeName: common.officialAssesseeName,
    assessmentDate: common.assessmentDate,
    writtenGrading: grading as Record<string, unknown> | null,
  });

  const resolvedMasterKey = resolveBatchActiveMasterKey(common.batch, batchFiles);
  const studentAnswerFile = pickLatestDriveFile(
    batchFiles.filter(
      (f) => f.assesseeId === assesseeId && f.docType.toLowerCase() === "06c",
    ),
  );
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
  const schemeWrittenQuestions = resolveSchemeWrittenQuestions(common.scheme);

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

      {/* Encrypted 06B Key Unlock & Upload Panel (D12 + Checklist P1) */}
      <div className="glass-card rounded-2xl p-5 space-y-4 border-slate-200">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Kunci Jawaban 06B (Unggah Manual / OOXML &amp; Teks)
            </h2>
            <p className="text-xs text-slate-500">
              Jika folder Drive batch belum menyertakan berkas 06B, unggah dokumen kunci FR.IA.06B.docx di sini untuk dipakai seluruh asesi di batch ini. Kata sandi berkas terenkripsi tidak pernah disimpan di database atau log.
            </p>
          </div>
        </div>
        <WrittenKeyForm
          batchId={batchId}
          assesseeId={assesseeId}
          activeKeyFileName={
            resolvedMasterKey.isReadyForGrading
              ? (resolvedMasterKey.activeFile?.fileName ?? null)
              : null
          }
          activeKeySourceLabel={resolvedMasterKey.activeOriginLabel}
          activeKeyValidationSummary={resolvedMasterKey.validation?.summary ?? null}
          isBatchKeyReady={resolvedMasterKey.isReadyForGrading}
          blockingWarning={resolvedMasterKey.blockingWarning}
          initialMasterKeyText={
            resolvedMasterKey.isReadyForGrading
              ? (resolvedMasterKey.activeFile?.extractedText ?? "")
              : ""
          }
          initialStudentAnswerText={studentAnswerFile?.extractedText ?? ""}
        />
      </div>

      {/* Scheme Manifest 06A Questions (D17/D21) */}
      {schemeWrittenQuestions.length > 0 && (
        <details className="glass-card rounded-2xl p-5 text-xs space-y-2">
          <summary className="cursor-pointer font-semibold text-slate-900">
            Bank Soal Tertulis Skema FR.IA.06A ({schemeWrittenQuestions.length} butir dari manifes{" "}
            {common.scheme?.code})
          </summary>
          <ol className="list-decimal pl-5 pt-2 space-y-1.5 text-slate-700">
            {schemeWrittenQuestions.map((q) => (
              <li key={q.no}>
                {q.unitCode && (
                  <span className="font-mono text-[11px] px-1.5 py-0.5 mr-1.5 rounded bg-slate-100 text-slate-700">
                    {q.unitCode}
                  </span>
                )}
                {q.question}
              </li>
            ))}
          </ol>
        </details>
      )}

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
            ) : plagiarism?.status === "Bersih" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Clock className="w-5 h-5 text-slate-400" />
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

      {/* Official Unaltered FR.IA.06C Assessment Form, Blanko Preview & DOCX Export */}
      <div id="form-06c" className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Formulir Resmi FR.IA.06C (Lembar Jawaban Pertanyaan Tertulis Esai)
          </h2>
          <p className="text-xs text-slate-500">
            Tampilan blanko asli BNSP beserta pencapaian Ya/Tidak dan umpan balik untuk asesi.
          </p>
        </div>
        <Ia06cAssessmentForm
          key={String(grading?.id ?? "none")}
          batchId={batchId}
          assesseeId={assesseeId}
          schemeQuestions={schemeWrittenQuestions}
          initialAssessment={savedOfficial06c}
          hasSavedAssessment={hasSavedOfficial06c}
          aiProposal={aiProposal06c}
        />
        {!hasSavedOfficial06c && aiProposal06c.hasProposal && (
          <div
            role="status"
            className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950"
          >
            <strong>Pratinjau Blanko Resmi Menunggu Simpan:</strong> Usulan AI sudah terisi pada
            formulir di atas, namun tanda centang pada blanko resmi &amp; ekspor DOCX tetap netral
            sampai asesor memeriksa/mengoreksi dan menekan <strong>Simpan Penilaian FR.IA.06C</strong>.
          </div>
        )}
        <Ia06cBlankoPreview
          batchId={batchId}
          assesseeId={assesseeId}
          hasActiveSignature={common.hasActiveSignature}
          signatureUrl={common.signatureUrl}
          isNameConfirmed={common.isNameConfirmed}
          payload={ia06cPayload}
        />
      </div>
    </div>
  );
}
