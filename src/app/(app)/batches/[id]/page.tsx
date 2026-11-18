import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AlertTriangle,
  ExternalLink,
  FileCheck,
  GitMerge,
  Layers,
  RefreshCw,
  Users,
} from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { getLatestJobForBatch } from "@/repositories/jobs.repository";
import { enqueueJob } from "@/worker/queue";
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

  const [assessees, files, latestJob] = await Promise.all([
    listAssesseesByBatch(user.id, id),
    listDriveFilesForBatch(user.id, id),
    getLatestJobForBatch(user.id, id),
  ]);

  const userId = user.id;
  const batchId = batch.id;
  const driveFolderUrl = batch.driveFolderUrl;

  async function rescanBatchDriveAction() {
    "use server";
    if (!driveFolderUrl) return;
    await enqueueJob({
      userId,
      type: "drive_scan",
      payload: { batchId, driveFolderUrl },
    });
    revalidatePath(`/batches/${batchId}`);
    revalidatePath(`/batches/${batchId}/triage`);
    revalidatePath("/batches");
    revalidatePath("/dashboard");
  }

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
        <div className="flex flex-wrap items-center gap-2">
          {batch.driveFolderUrl && (
            <form action={rescanBatchDriveAction}>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
                Pindai Ulang Drive
              </button>
            </form>
          )}
          {latestJob && (
            <Link
              href={`/batches/${batch.id}/ingest/${latestJob.id}`}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              Status Pindai ({latestJob.status})
            </Link>
          )}
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
            Kemiripan &amp; Laporan
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

      {latestJob?.status === "failed" && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Pemindaian Drive Terakhir Gagal</p>
              <p className="font-mono mt-0.5">{latestJob.error || "Unknown worker error"}</p>
            </div>
          </div>
          <Link
            href={`/batches/${batch.id}/ingest/${latestJob.id}`}
            className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-medium"
          >
            Lihat Log Job &amp; Coba Lagi
          </Link>
        </div>
      )}

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
