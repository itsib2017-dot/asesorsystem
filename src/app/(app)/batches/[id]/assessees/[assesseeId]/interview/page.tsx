import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, MessageSquare } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { decryptSecret } from "@/lib/crypto/encryption";
import { loadAssesseeCommonFormMeta } from "@/lib/forms/load-assessee-page-data";
import { resolveSchemeInterviewQuestions } from "@/lib/forms/assessee-forms";
import { resolveUnitsForScheme } from "@/lib/forms/sync-vatm-decisions";
import { getLatestInterviewAssessment } from "@/repositories/assessment.repository";
import { listDriveFilesForBatch } from "@/repositories/batches.repository";
import { getLatestProviderConfigForAssessor } from "@/repositories/provider.repository";
import { ensureDriveFileExtracted } from "@/services/drive-extract";
import {
  InterviewAssessmentForm,
  type InterviewQuestionItem,
  type InterviewUnitItem,
} from "./_components/interview-assessment-form";

export const metadata = {
  title: "Wawancara FR.IA.09 — AsesorKompetensi",
};

function parseQuestionsFromText(
  rawText: string,
  units: Array<{ code: string; title: string }>,
): InterviewQuestionItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && /\?$/.test(l));

  if (lines.length > 0) {
    return lines.slice(0, 15).map((q, idx) => ({
      no: idx + 1,
      question: q.replace(/^\d+[.)]\s*/, ""),
      answerSummary: "",
      achieved: null,
      unitCode: units[idx]?.code,
    }));
  }

  return units.map((u, idx) => ({
    no: idx + 1,
    question: `Klarifikasi bukti portofolio & penerapan kompetensi pada unit: ${u.title}?`,
    answerSummary: "",
    achieved: null,
    unitCode: u.code,
  }));
}

export default async function InterviewPage({
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

  const [files, latestInterview, providerCfg] = await Promise.all([
    listDriveFilesForBatch(user.id, batchId),
    getLatestInterviewAssessment(user.id, assesseeId),
    getLatestProviderConfigForAssessor(user.id),
  ]);

  const assesseeFiles = files.filter((f) => f.assesseeId === assesseeId);
  const interviewFiles = assesseeFiles.filter((f) => f.docType === "09");
  const portfolioFiles = assesseeFiles.filter((f) => f.docType === "portofolio");

  let driveApiKey: string | undefined;
  if (providerCfg?.googleDriveApiKeyEncrypted) {
    try {
      driveApiKey = decryptSecret(providerCfg.googleDriveApiKeyEncrypted) || undefined;
    } catch {
      driveApiKey = undefined;
    }
  }

  const primary09 = interviewFiles[0] ?? null;
  let extracted09Text = primary09?.extractedText ?? "";
  let extractionNote: string | null = null;
  if (primary09 && !extracted09Text.trim()) {
    const res = await ensureDriveFileExtracted({
      userId: user.id,
      file: primary09,
      apiKey: driveApiKey,
    });
    extracted09Text = res.text ?? "";
    if (!extracted09Text && res.error) {
      extractionNote = res.error;
    }
  }

  const schemeUnits = resolveUnitsForScheme(common.scheme);
  const manifestInterviewQuestions = resolveSchemeInterviewQuestions(common.scheme);

  const savedQuestions = Array.isArray(latestInterview?.questions)
    ? (latestInterview.questions as InterviewQuestionItem[])
    : null;
  const parsed09Questions = extracted09Text.trim()
    ? parseQuestionsFromText(extracted09Text, schemeUnits)
    : [];
  const manifestFallbackQuestions: InterviewQuestionItem[] = manifestInterviewQuestions.map(
    (q, idx) => ({
      no: q.no || idx + 1,
      question: q.question,
      answerSummary: "",
      achieved: null,
      unitCode: q.unitCode || schemeUnits[idx]?.code,
    }),
  );
  const initialQuestions =
    savedQuestions && savedQuestions.length > 0
      ? savedQuestions
      : parsed09Questions.length > 0 && extracted09Text.trim().length > 0
        ? parsed09Questions
        : manifestFallbackQuestions.length > 0
          ? manifestFallbackQuestions
          : parseQuestionsFromText("", schemeUnits);

  const savedUnits = Array.isArray(
    latestInterview?.vatm_unit_recommendations ?? latestInterview?.vatmUnitRecommendations,
  )
    ? ((latestInterview?.vatm_unit_recommendations ??
        latestInterview?.vatmUnitRecommendations) as InterviewUnitItem[])
    : null;

  const initialUnits: InterviewUnitItem[] =
    savedUnits && savedUnits.length > 0
      ? savedUnits
      : schemeUnits.map((u) => ({
          unitCode: u.code,
          unitTitle: u.title,
          recommendation: null,
          reasoning: "",
        }));

  const savedOverall = (latestInterview?.overall_recommendation ??
    latestInterview?.overallRecommendation) as "K" | "BK" | undefined;
  const savedNotes = String(
    latestInterview?.assessor_notes ?? latestInterview?.assessorNotes ?? "",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={`/batches/${batchId}/assessees/${assesseeId}`}
            className="text-xs text-teal-700 hover:underline"
          >
            &larr; Kembali ke Detail Asesi
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Wawancara Kompetensi FR.IA.09 ({common.assessee.displayName})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Menampilkan berkas wawancara (kode 09) dan portofolio pendukung untuk penilaian VATM asesor.
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            savedOverall === "K"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : savedOverall === "BK"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-slate-100 border-slate-200 text-slate-700"
          }`}
        >
          Status Wawancara: {savedOverall ?? "Belum dinilai"}
        </span>
      </div>

      {/* Scanned 09 & Portfolio Files Card */}
      <div className="glass-card rounded-2xl p-5 space-y-3 border border-slate-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessageSquare className="w-4 h-4 text-teal-700" />
          Berkas Wawancara (09) &amp; Portofolio Terpindai
        </div>

        {interviewFiles.length === 0 && portfolioFiles.length === 0 ? (
          <p className="text-xs text-slate-500">
            Belum ada berkas berkode <code>09</code> atau portofolio yang terpetakan ke asesi ini. Periksa{" "}
            <Link href={`/batches/${batchId}/triage`} className="underline text-teal-700">
              Triage Berkas
            </Link>{" "}
            atau lakukan penilaian langsung pada form wawancara di bawah.
          </p>
        ) : (
          <div className="space-y-2 text-xs">
            {interviewFiles.map((f) => (
              <div
                key={f.id}
                className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">{f.fileName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{f.drivePath}</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white border border-teal-300 font-mono text-[11px] text-teal-800">
                  docType: {f.docType}
                </span>
              </div>
            ))}
            {portfolioFiles.map((f) => (
              <div
                key={f.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
              >
                <span className="text-slate-700">{f.fileName}</span>
                <span className="font-mono text-[11px] text-slate-500">portofolio</span>
              </div>
            ))}
          </div>
        )}

        {extractionNote && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            Catatan ekstraksi berkas 09: {extractionNote}
          </p>
        )}

        {extracted09Text && (
          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">
              Teks Ekstraksi Berkas FR.IA.09 ({extracted09Text.length} karakter)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-slate-700 max-h-60 overflow-y-auto">
              {extracted09Text}
            </pre>
          </details>
        )}
      </div>

      <InterviewAssessmentForm
        batchId={batchId}
        assesseeId={assesseeId}
        sourceFileId={primary09?.id ?? null}
        initialQuestions={initialQuestions}
        initialUnits={initialUnits}
        initialOverall={savedOverall ?? null}
        initialNotes={savedNotes}
      />
    </div>
  );
}
