import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/get-session";
import { getBatchById } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { getActiveSignature } from "@/repositories/signatures.repository";
import { getAssessorProfile } from "@/repositories/auth.repository";
import { getAk05ReportForBatch } from "@/repositories/assessment.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { resolveAk05BatchRows } from "@/lib/ak05/rollup";
import { extractSchemeMeta, resolveSchemeBranding } from "@/lib/forms/assessee-forms";
import { Ak05Preview } from "@/components/ak05/ak05-preview";

export const metadata = {
  title: "Laporan FR.AK.05 — AsesorKompetensi",
};

export default async function Ak05Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  if (!user) return notFound();

  const { id: batchId } = await params;
  const batch = await getBatchById(user.id, batchId);
  if (!batch) return notFound();

  const [assessees, signature, profile, report, schemes] = await Promise.all([
    listAssesseesByBatch(user.id, batchId),
    getActiveSignature(user.id),
    getAssessorProfile(user.id),
    getAk05ReportForBatch(user.id, batchId),
    listSchemes(user.id, batch.lspId),
  ]);

  const scheme = schemes.find((s) => s.id === batch.schemeId) ?? null;
  const { schemeTitle, schemeNumber } = extractSchemeMeta(scheme);

  const unconfirmedCount = assessees.filter(
    (a) => !a.certificateNameConfirmed,
  ).length;
  const rows = await resolveAk05BatchRows(user.id, batchId, assessees);
  const undecidedCount = rows.filter((r) => r.undecided).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/batches/${batchId}`} className="text-xs text-teal-700 hover:underline">
          &larr; Kembali ke Batch
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
          FR.AK.05 Laporan Asesmen ({batch.name})
        </h1>
      </div>

      <Ak05Preview
        batchId={batchId}
        branding={resolveSchemeBranding(scheme)}
        schemeTitle={schemeTitle}
        schemeNumber={schemeNumber}
        tukName={batch.tukName ?? "-"}
        tukType={batch.tukType ?? "sewaktu"}
        assessorName={
          (profile?.fullName as string) || (profile?.full_name as string) || user.email || "Asesor"
        }
        assessorRegNo={(profile?.regNoMet as string) || (profile?.reg_no_met as string) || "-"}
        assessmentDate={batch.assessmentDate ?? ""}
        hasActiveSignature={Boolean(signature)}
        signatureUrl={signature?.signedUrl}
        unconfirmedNamesCount={unconfirmedCount}
        undecidedCount={undecidedCount}
        rows={rows.map((r) => ({
          no: r.no,
          assesseeName: r.assesseeName,
          recommendation: r.recommendation,
          keterangan: r.keterangan,
        }))}
        notesPositiveNegative={String(
          report?.notes_positive_negative ?? report?.notesPositiveNegative ?? "",
        )}
        notesRejection={String(report?.notes_rejection ?? report?.notesRejection ?? "")}
        notesImprovement={String(report?.notes_improvement ?? report?.notesImprovement ?? "")}
      />
    </div>
  );
}
