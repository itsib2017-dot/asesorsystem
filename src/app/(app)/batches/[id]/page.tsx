import Link from "next/link";
import { notFound } from "next/navigation";
import { GitMerge, Users, FileCheck, Layers } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { CompletenessMatrix, type CompletenessRow } from "@/components/batch/completeness-matrix";

export const metadata = {
  title: "Detail Batch — AsesorKompetensi",
};

const DEFAULT_DOC_COLUMNS = ["APL.01", "APL.02", "KTP", "Ijazah", "Pas Foto", "CV", "04A", "06C"];

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  if (!user) return notFound();

  const { id } = await params;
  const batch = await getBatchById(user.id, id);
  if (!batch) return notFound();

  const assessees = await listAssesseesByBatch(user.id, id);
  const files = await listDriveFilesForBatch(user.id, id);

  const rows: CompletenessRow[] = assessees.map((a) => {
    const aFiles = files.filter((f) => f.assesseeId === a.id);
    const docs: Record<string, "complete" | "warning" | "missing"> = {};
    for (const col of DEFAULT_DOC_COLUMNS) {
      const key = col.toLowerCase().replace(/\./g, "").replace(/\s+/g, "_");
      const matched = aFiles.find((f) => f.docType === key);
      docs[col] = matched
        ? matched.ocrConfidence !== null && matched.ocrConfidence < 0.75
          ? "warning"
          : "complete"
        : "missing";
    }

    return {
      assesseeId: a.id,
      displayName: a.displayName,
      certificateNameConfirmed: a.certificateNameConfirmed,
      completenessStatus: a.completenessStatus,
      docs,
    };
  });

  const unmatchedCount = files.filter((f) => f.triageStatus === "unmatched").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-slate-500">BATCH ID: {batch.id.slice(0, 8)}</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{batch.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            TUK: {batch.tukName || "-"} ({batch.tukType || "sewaktu"}) · Status:{" "}
            <strong className="text-slate-700">{batch.status}</strong>
          </p>
        </div>

        {/* Sub-Navigation Pills */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/batches/${batch.id}/triage`}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            Triage ({unmatchedCount})
          </Link>
          <Link
            href={`/batches/${batch.id}/similarity`}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5"
          >
            <GitMerge className="w-3.5 h-3.5 text-blue-600" />
            Kemiripan & Laporan
          </Link>
          <Link
            href={`/batches/${batch.id}/ak05`}
            className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-xs font-medium text-white inline-flex items-center gap-1.5"
          >
            <FileCheck className="w-3.5 h-3.5" />
            Laporan FR.AK.05
          </Link>
        </div>
      </div>

      {/* Completeness Matrix */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Users className="w-4 h-4 text-teal-700" />
          Matriks Kelengkapan Berkas Asesi ({assessees.length} Asesi · {files.length} Berkas Drive)
        </div>
        <CompletenessMatrix batchId={batch.id} docColumns={DEFAULT_DOC_COLUMNS} rows={rows} />
      </div>
    </div>
  );
}
