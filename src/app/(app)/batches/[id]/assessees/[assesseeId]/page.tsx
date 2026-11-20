import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSearch, FileSpreadsheet, MessageSquare } from "lucide-react";
import { getLspRole } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { getLatestNameJuryVerdict } from "@/repositories/assessees.repository";
import {
  getAssesseeDecisionOverride,
  getLatestDitAnalysis,
  getLatestInterviewAssessment,
  getLatestWrittenGrading,
  listDecisionsForAssessee,
} from "@/repositories/assessment.repository";
import { listDriveFilesForBatch } from "@/repositories/batches.repository";
import { NameJuryCard } from "@/components/identity/name-jury-card";
import { OcrKtpTrigger } from "./ocr-ktp-trigger";
import { DecisionToggle } from "@/components/ak05/decision-toggle";
import { Ak02BlankoPreview } from "@/components/forms/ak02-blanko-preview";
import { loadAssesseeCommonFormMeta } from "@/lib/forms/load-assessee-page-data";
import {
  resolveAssesseeOverallDecision,
  type UnitDecisionLike,
} from "@/lib/ak05/decision-rules";
import {
  buildAk02Payload,
  resolveSchemeBranding,
  resolveSchemeUnitsList,
  type RawDecisionRow,
} from "@/lib/forms/assessee-forms";
import { resolveUnitsForScheme } from "@/lib/forms/sync-vatm-decisions";
import { computeVatmUnitRollup } from "@/services/vatm-rollup";
import { OverallDecisionOverrideCard } from "./_components/overall-decision-override";
import {
  confirmCertificateNameAction,
  saveOverallDecisionOverrideAction,
  saveUnitDecisionAction,
} from "./actions";

export const metadata = {
  title: "Detail Asesi — AsesorKompetensi",
};

export default async function AssesseeDetailPage({
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

  const [
    jury,
    decisions,
    decisionOverride,
    ditAnalysis,
    writtenGrading,
    interviewAssessment,
    role,
    batchFiles,
  ] = await Promise.all([
    getLatestNameJuryVerdict(user.id, assesseeId),
    listDecisionsForAssessee(user.id, assesseeId),
    getAssesseeDecisionOverride(user.id, assesseeId),
    getLatestDitAnalysis(user.id, assesseeId),
    getLatestWrittenGrading(user.id, assesseeId),
    getLatestInterviewAssessment(user.id, assesseeId),
    getLspRole(common.batch.lspId, user.id),
    listDriveFilesForBatch(user.id, batchId),
  ]);
  const hasDitForms = batchFiles.some(
    (f) => f.assesseeId === assesseeId && (f.docType === "dit_form" || f.docType === "04b"),
  );

  // If the jury verdict row is not yet readable, still surface the OCR evidence
  // and require a human decision rather than showing "not run".
  const ktpOcrFile = batchFiles.find(
    (f) => f.assesseeId === assesseeId && f.docType === "ktp" && f.ocrConfidence != null,
  );
  const rawOcrConfidence = ktpOcrFile?.ocrConfidence ?? null;
  const resolvedOcrConfidence = jury
    ? jury.ocr_confidence ?? jury.ocrConfidence
    : rawOcrConfidence != null
      ? rawOcrConfidence > 1
        ? rawOcrConfidence / 100
        : rawOcrConfidence
      : null;
  const hasOcrEvidence = Boolean(assessee.ktpNameOcr?.trim());
  const resolvedVerdict = jury?.verdict
    ? (jury.verdict as "match" | "mismatch_resolved" | "needs_human")
    : hasOcrEvidence
      ? "needs_human"
      : "not_run";

  const schemeUnitsList = resolveSchemeUnitsList(common.scheme);
  const resolvedOverall = resolveAssesseeOverallDecision({
    unitDecisions: decisions as unknown as UnitDecisionLike[],
    totalSchemeUnits: schemeUnitsList.length,
    manualOverride: decisionOverride,
  });
  const canOverride = role === "lsp_admin" || role === "assessor";

  const rollupUnits = computeVatmUnitRollup({
    units: resolveUnitsForScheme(common.scheme),
    ditAnalysis: ditAnalysis as Record<string, unknown> | null,
    writtenGrading: writtenGrading as Record<string, unknown> | null,
    interviewAssessment: interviewAssessment as Record<string, unknown> | null,
  });

  const decisionByCode = new Map(
    (decisions as Array<Record<string, unknown>>).map((d) => [
      String(d.unitCode ?? d.unit_code ?? "").trim().toLowerCase(),
      d,
    ]),
  );

  const mergedUnitRows = rollupUnits.map((u) => {
    const saved = decisionByCode.get(u.unitCode.trim().toLowerCase());
    return {
      unitCode: u.unitCode,
      unitTitle: u.unitTitle,
      // Single live UI truth: live computeVatmUnitRollup output avoids stale DB ai_recommendation drift
      aiRecommendation: u.aiRecommendation,
      vatmReasoning: u.vatmReasoning,
      decision: (saved?.decision as "K" | "BK" | null | undefined) ?? null,
      assessorNote:
        ((saved?.assessorNote ?? saved?.assessor_note) as string | null | undefined) ?? null,
    };
  });

  const ak02Payload = buildAk02Payload({
    scheme: common.scheme,
    schemeTitle: common.schemeTitle,
    schemeNumber: common.schemeNumber,
    tukType: common.batch.tukType,
    assessorName: common.assessorName,
    assessorRegNo: common.assessorRegNo,
    assesseeName: common.officialAssesseeName,
    assessmentDate: common.assessmentDate,
    decisions: decisions as unknown as RawDecisionRow[],
    manualOverride: decisionOverride,
    resolvedOverall,
    hasDit: Boolean(ditAnalysis),
    hasDitForms,
    hasWritten: Boolean(writtenGrading),
    hasInterview: Boolean(interviewAssessment),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/batches/${batchId}`} className="text-xs text-teal-700 hover:underline">
            &larr; Kembali ke Batch
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            {assessee.displayName}
          </h1>
          <p className="text-xs text-slate-500 font-mono">
            Pseudonim AI: {assessee.pseudonym || "ASESI-001"} · Kelengkapan: {assessee.completenessStatus}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/batches/${batchId}/assessees/${assesseeId}/dit`}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5"
          >
            <FileSearch className="w-4 h-4 text-teal-700" />
            Analisis DIT (FR.IA.04A &amp; 04B)
          </Link>
          <Link
            href={`/batches/${batchId}/assessees/${assesseeId}/written`}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-700" />
            Penilaian Tertulis (FR.IA.06)
          </Link>
          <Link
            href={`/batches/${batchId}/assessees/${assesseeId}/interview`}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4 text-amber-700" />
            Wawancara (FR.IA.09)
          </Link>
        </div>
      </div>

      {/* Name Jury & KTP Verification */}
      <NameJuryCard
        assesseeId={assessee.id}
        ktpOcrName={assessee.ktpNameOcr ?? ""}
        apl01Name={assessee.apl01Name || assessee.displayName}
        suratTugasName={assessee.suratTugasName || "-"}
        ijazahName={assessee.ijazahName || "-"}
        ocrConfidence={
          resolvedOcrConfidence != null ? Number(resolvedOcrConfidence) : null
        }
        verdict={resolvedVerdict}
        proposedName={
          (jury?.proposed_certificate_name as string | null) ??
          (jury?.proposedCertificateName as string | null) ??
          assessee.ktpNameOcr ??
          null
        }
        reasoning={
          (jury?.reasoning as string) ||
          (hasOcrEvidence
            ? "OCR lokal selesai dan teks KTP terbaca. Rekomendasi juri belum tersedia; keputusan nama sertifikat memerlukan manusia."
            : "Juri Nama / OCR KTP belum dijalankan. Periksa dokumen KTP asli dan konfirmasi nama sertifikat secara manual atau jalankan OCR.")
        }
        confirmedName={assessee.certificateNameConfirmed}
        onConfirmAction={confirmCertificateNameAction}
      />
      <OcrKtpTrigger assesseeId={assessee.id} batchId={batchId} />

      {/* FR.AK.02 Per-Unit K / BK Decisions */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Keputusan Per Unit Kompetensi (FR.AK.02 — K / BK Biner)
          </h2>
          <p className="text-xs text-slate-500">
            Keputusan bersifat biner: Kompeten (K) atau Belum Kompeten (BK) berdasarkan prinsip VATM.
          </p>
        </div>

        <div className="space-y-3">
          {mergedUnitRows.map((d) => (
            <DecisionToggle
              key={d.unitCode}
              assesseeId={assessee.id}
              batchId={batchId}
              unitCode={d.unitCode}
              unitTitle={d.unitTitle}
              aiRecommendation={d.aiRecommendation}
              vatmReasoning={d.vatmReasoning}
              initialDecision={d.decision}
              initialNote={d.assessorNote}
              onSaveDecision={saveUnitDecisionAction}
            />
          ))}
        </div>
      </div>

      {/* Automatic BK Roll-Up & Authorized Manual Final-Call Override */}
      <OverallDecisionOverrideCard
        batchId={batchId}
        assesseeId={assessee.id}
        autoRecommendation={resolvedOverall.autoRecommendation}
        finalRecommendation={resolvedOverall.recommendation}
        isOverridden={resolvedOverall.isOverridden}
        overrideReason={resolvedOverall.overrideReason}
        overriddenAt={resolvedOverall.overriddenAt}
        decidedCount={resolvedOverall.decidedCount}
        kCount={resolvedOverall.kCount}
        bkCount={resolvedOverall.bkCount}
        totalSchemeUnits={schemeUnitsList.length}
        bkUnitLabels={resolvedOverall.bkUnitLabels}
        canOverride={canOverride}
        onSaveOverrideAction={saveOverallDecisionOverrideAction}
      />

      {/* Official Unaltered FR.AK.02 Blanko Preview & DOCX Export */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Formulir Resmi FR.AK.02 (Rekaman Asesmen Kompetensi)
          </h2>
          <p className="text-xs text-slate-500">
            Tampilan blanko asli BNSP untuk pencetakan &amp; arsip rekaman asesmen per asesi.
          </p>
        </div>
        <Ak02BlankoPreview
          batchId={batchId}
          assesseeId={assesseeId}
          hasActiveSignature={common.hasActiveSignature}
          signatureUrl={common.signatureUrl}
          isNameConfirmed={common.isNameConfirmed}
          branding={resolveSchemeBranding(common.scheme)}
          payload={ak02Payload}
        />
      </div>
    </div>
  );
}
