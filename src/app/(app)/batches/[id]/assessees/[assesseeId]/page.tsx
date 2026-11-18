import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSearch, FileSpreadsheet } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { getAssesseeById, getLatestNameJuryVerdict } from "@/repositories/assessees.repository";
import { listDecisionsForAssessee } from "@/repositories/assessment.repository";
import { NameJuryCard } from "@/components/identity/name-jury-card";
import { DecisionToggle } from "@/components/ak05/decision-toggle";
import { confirmCertificateNameAction, saveUnitDecisionAction } from "./actions";

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
  const assessee = await getAssesseeById(user.id, assesseeId);
  if (!assessee) return notFound();

  const jury = await getLatestNameJuryVerdict(user.id, assesseeId);
  const decisions = await listDecisionsForAssessee(user.id, assesseeId);

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

        <div className="flex gap-2">
          <Link
            href={`/batches/${batchId}/assessees/${assesseeId}/dit`}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5"
          >
            <FileSearch className="w-4 h-4 text-teal-700" />
            Analisis DIT (FR.IA.04A & 04B)
          </Link>
          <Link
            href={`/batches/${batchId}/assessees/${assesseeId}/written`}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-700" />
            Penilaian Tertulis (FR.IA.06)
          </Link>
        </div>
      </div>

      {/* Name Jury & KTP Verification */}
      <NameJuryCard
        assesseeId={assessee.id}
        ktpOcrName={assessee.ktpNameOcr || assessee.displayName}
        apl01Name={assessee.apl01Name || assessee.displayName}
        suratTugasName={assessee.suratTugasName || "-"}
        ijazahName={assessee.ijazahName || "-"}
        ocrConfidence={Number(jury?.ocr_confidence ?? jury?.ocrConfidence ?? 0.92)}
        verdict={
          (jury?.verdict as "match" | "mismatch_resolved" | "needs_human") ?? "match"
        }
        proposedName={
          (jury?.proposed_certificate_name as string | null) ??
          (jury?.proposedCertificateName as string | null) ??
          assessee.ktpNameOcr ??
          assessee.displayName
        }
        reasoning={
          (jury?.reasoning as string) ||
          "Membandingkan sumber KTP OCR lokal dengan APL.01, Surat Tugas, dan Ijazah — menunggu konfirmasi asesor."
        }
        confirmedName={assessee.certificateNameConfirmed}
        onConfirmAction={confirmCertificateNameAction}
      />

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

        {decisions.length === 0 ? (
          <p className="text-xs text-slate-500">
            Belum ada rekomendasi unit yang tercatat. Jalankan penilaian tertulis atau analisis DIT untuk memunculkan rekomendasi VATM per unit.
          </p>
        ) : (
          <div className="space-y-3">
            {decisions.map((d: Record<string, unknown>) => (
              <DecisionToggle
                key={String(d.unitCode ?? d.unit_code)}
                assesseeId={assessee.id}
                batchId={batchId}
                unitCode={String(d.unitCode ?? d.unit_code)}
                unitTitle={String(d.unitTitle ?? d.unit_title)}
                aiRecommendation={(d.aiRecommendation ?? d.ai_recommendation) as "K" | "BK" | null}
                vatmReasoning={(d.vatmReasoning ?? d.vatm_reasoning) as string | null}
                initialDecision={(d.decision as "K" | "BK" | null)}
                initialNote={(d.assessorNote ?? d.assessor_note) as string | null}
                onSaveDecision={saveUnitDecisionAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
