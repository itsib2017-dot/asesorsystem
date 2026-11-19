import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, Lock } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { listDriveFilesForBatch } from "@/repositories/batches.repository";
import {
  getAssesseeDecisionOverride,
  getLatestDitAnalysis,
  listDecisionsForAssessee,
} from "@/repositories/assessment.repository";
import { checkDitCompletenessGate } from "@/services/dit";
import {
  formatSchemeInstructionsText,
  selectDitInputFiles,
} from "@/lib/forms/dit-inputs";
import { Ia04bBlankoPreview } from "@/components/forms/ia04b-blanko-preview";
import { loadAssesseeCommonFormMeta } from "@/lib/forms/load-assessee-page-data";
import {
  buildIa04bPayload,
  resolveSchemeKelompokPekerjaan,
  type RawDecisionRow,
} from "@/lib/forms/assessee-forms";
import { DitAnalysisTrigger } from "./_components/dit-analysis-trigger";

export const metadata = {
  title: "Analisis DIT — AsesorKompetensi",
};

export default async function DitAnalysisPage({
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

  const [files, analysis, decisions, decisionOverride] = await Promise.all([
    listDriveFilesForBatch(user.id, batchId),
    getLatestDitAnalysis(user.id, assesseeId),
    listDecisionsForAssessee(user.id, assesseeId),
    getAssesseeDecisionOverride(user.id, assesseeId),
  ]);
  const assesseeFiles = files.filter((f) => f.assesseeId === assesseeId);
  const {
    assessee04a,
    sharedBatch04a,
    used04aFiles,
    combinedDitFiles,
    usedCvFile: fileCv,
  } = selectDitInputFiles(assesseeFiles, files);
  const scheme04aFallback =
    used04aFiles.length === 0 ? formatSchemeInstructionsText(common.scheme) : "";

  const fr04aExtracted = used04aFiles
    .map((f) => f.extractedText?.trim())
    .filter(Boolean)
    .join("\n\n") || scheme04aFallback || null;
  const ditExtracted =
    combinedDitFiles
      .map((f) => f.extractedText?.trim())
      .filter(Boolean)
      .join("\n\n") || null;
  const cvExtracted = fileCv?.extractedText?.trim() || null;

  const gate = checkDitCompletenessGate({
    frIa04aText: fr04aExtracted ?? (used04aFiles.length > 0 ? "pending-drive-extraction" : null),
    presentationTranscript:
      ditExtracted ?? (combinedDitFiles.length > 0 ? "pending-drive-extraction" : null),
    candidateProfileSummary: cvExtracted ?? (fileCv ? "pending-drive-extraction" : null),
  });

  const ia04bPayload = buildIa04bPayload({
    scheme: common.scheme,
    schemeTitle: common.schemeTitle,
    schemeNumber: common.schemeNumber,
    tukType: common.batch.tukType,
    assessorName: common.assessorName,
    assessorRegNo: common.assessorRegNo,
    assesseeName: common.officialAssesseeName,
    assessmentDate: common.assessmentDate,
    ditAnalysis: analysis as Record<string, unknown> | null,
    decisions: decisions as unknown as RawDecisionRow[],
    manualOverride: decisionOverride,
  });
  const coverageMatrix = Array.isArray(analysis?.coverage_matrix ?? analysis?.coverageMatrix)
    ? ((analysis?.coverage_matrix ?? analysis?.coverageMatrix) as Array<Record<string, unknown>>)
    : [];
  const questionBank = Array.isArray(analysis?.question_bank ?? analysis?.questionBank)
    ? ((analysis?.question_bank ?? analysis?.questionBank) as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/batches/${batchId}/assessees/${assesseeId}`} className="text-xs text-teal-700 hover:underline">
            &larr; Kembali ke Detail Asesi
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Analisis DIT — Daftar Instruksi Terstruktur ({assessee.displayName})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Formulir Resmi FR.IA.04B dan Bank Soal Asesor dipisahkan sesuai standar D14.
          </p>
        </div>

        <a
          href={`/api/v1/batches/${batchId}/assessees/${assesseeId}/export?form=ia04a&format=docx`}
          className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-xs font-medium text-white shadow-sm inline-flex items-center gap-2 shrink-0"
        >
          <FileText className="w-4 h-4" />
          Ekspor FR.IA.04A (.docx)
        </a>
      </div>

      {/* Rule 26: Completeness Gate */}
      {!gate.passed && !analysis && (
        <div className="glass-card rounded-2xl p-6 border-amber-300 bg-amber-50/70 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-amber-900 text-sm">
            <AlertCircle className="w-5 h-5 text-amber-700" />
            Analisis ditunda — bahan belum lengkap
          </div>
          <p className="text-xs text-amber-800">
            Sistem tidak menjalankan analisis parsial apabila dokumen wajib belum tersedia:
          </p>
          <ul className="list-disc pl-5 text-xs text-amber-900 space-y-1">
            {gate.missing.map((m) => (
              <li key={m.input}>{m.label}</li>
            ))}
          </ul>
          <div className="pt-2">
            <Link
              href={`/batches/${batchId}/triage`}
              className="inline-block px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-medium"
            >
              Periksa Triage Berkas
            </Link>
          </div>
        </div>
      )}

      {/* Explicit DIT Trigger (Cacat 1) */}
      <DitAnalysisTrigger
        assesseeId={assesseeId}
        hasExistingAnalysis={Boolean(analysis)}
        inputs={{
          fr04a: {
            label: "FR.IA.04A (Instruksi DIT)",
            fileName: used04aFiles[0]?.fileName ?? null,
            fileNames: used04aFiles.map((f) => f.fileName),
            sourceNote:
              used04aFiles.length === 0 && scheme04aFallback
                ? `Skema ${common.scheme?.code ?? common.schemeTitle}`
                : assessee04a.length === 0 && sharedBatch04a.length > 0
                  ? `Batch 04A (${sharedBatch04a[0]?.fileName ?? ""})`
                  : null,
            hasExtractedText: Boolean(fr04aExtracted),
          },
          fr04b: {
            label: "Tugas DIT (04B & Formulir)",
            fileName: combinedDitFiles[0]?.fileName ?? null,
            fileNames: combinedDitFiles.map((f) => f.fileName),
            hasExtractedText: Boolean(ditExtracted),
          },
          cv: {
            label: "Profil Kandidat (CV)",
            fileName: fileCv?.fileName ?? null,
            fileNames: fileCv ? [fileCv.fileName] : [],
            hasExtractedText: Boolean(cvExtracted),
          },
        }}
      />

      {/* Official FR.IA.04B Section (D14) */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Formulir Resmi FR.IA.04B (Penilaian Proyek Singkat / Presentasi)
            </h2>
            <p className="text-xs text-slate-500">
              Pertanyaan bawaan formulir per Kelompok Pekerjaan (bukti: tugas DIT &amp; presentasi). Rekomendasi biner K / BK.
            </p>
          </div>
          {analysis && (
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-100 text-slate-700">
              Model: {String(analysis.model)} · {String(analysis.prompt_version ?? analysis.promptVersion)}
            </span>
          )}
        </div>

        <Ia04bBlankoPreview
          batchId={batchId}
          assesseeId={assesseeId}
          hasActiveSignature={common.hasActiveSignature}
          signatureUrl={common.signatureUrl}
          isNameConfirmed={common.isNameConfirmed}
          kelompokPekerjaan={resolveSchemeKelompokPekerjaan(common.scheme)}
          payload={ia04bPayload}
        />

        {coverageMatrix.length > 0 && (
          <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">
              Catatan Matriks Cakupan AI ({coverageMatrix.length} poin fokus — Alat Bantu Asesor)
            </summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs text-left border-collapse border border-slate-200 bg-white">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 border border-slate-200">No</th>
                    <th className="p-2 border border-slate-200">Kelompok Pekerjaan</th>
                    <th className="p-2 border border-slate-200">Titik Fokus</th>
                    <th className="p-2 border border-slate-200">Status</th>
                    <th className="p-2 border border-slate-200">Kutipan Bukti</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageMatrix.map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border border-slate-200">{String(row.no ?? idx + 1)}</td>
                      <td className="p-2 border border-slate-200">{String(row.kelompokPekerjaan ?? "-")}</td>
                      <td className="p-2 border border-slate-200">{String(row.focusPoint ?? "-")}</td>
                      <td className="p-2 border border-slate-200 font-semibold">{String(row.status ?? "-")}</td>
                      <td className="p-2 border border-slate-200 italic">{String(row.evidenceSpan ?? "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      {/* Separate Artefact: Assessor Question Bank (NOT Official FR.IA.04B) */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Bank Soal Personalisasi Asesor (Bukan Formulir Resmi FR.IA.04B)
            </h2>
            <p className="text-xs text-slate-500">
              Artefak terpisah sesuai aturan D14. Jumlah butir soal mengikuti manifes skema aktif.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" /> Rekomendasi AI
          </span>
        </div>

        {questionBank.length > 0 ? (
          <div className="space-y-3">
            {questionBank.map((q, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">Soal #{String(q.no ?? idx + 1)}</span>
                  <span className="font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    [{String(q.dimension ?? "TS")}] {String(q.kelompokPekerjaan ?? "")}
                  </span>
                </div>
                <p className="text-sm text-slate-800">{String(q.question ?? "")}</p>
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer font-medium inline-flex items-center gap-1 text-slate-700">
                    <Lock className="w-3 h-3" /> Jawaban Model — Hanya untuk Asesor
                  </summary>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {Array.isArray(q.modelAnswerKeyPoints) &&
                      q.modelAnswerKeyPoints.map((pt, i) => <li key={i}>{String(pt)}</li>)}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Bank soal akan dibuat otomatis setelah bahan lengkap dan analisis DIT dijalankan.</p>
        )}
      </div>
    </div>
  );
}
