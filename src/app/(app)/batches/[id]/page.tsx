import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  GitMerge,
  Layers,
  Users,
} from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { getConfig } from "@/lib/config/get-config";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { getLatestJobForBatch } from "@/repositories/jobs.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { resolveSchemeDocColumns } from "@/lib/forms/assessee-forms";
import { pickLatestDriveFile } from "@/services/drive-revisions";
import { enqueueJob } from "@/worker/queue";
import { CompletenessMatrix, type CompletenessRow } from "@/components/batch/completeness-matrix";
import { BatchKeyUploadPanel } from "@/components/batch/batch-key-upload-panel";
import { JobStatusPoller } from "@/components/batch/job-status-poller";
import { RescanDriveButton } from "./_components/rescan-drive-button";

export const metadata = {
  title: "Detail Batch — AsesorKompetensi",
};

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

  const [assessees, files, latestJob, schemes, configuredMinOcr] = await Promise.all([
    listAssesseesByBatch(user.id, id),
    listDriveFilesForBatch(user.id, id),
    getLatestJobForBatch(user.id, id),
    listSchemes(user.id, batch.lspId),
    getConfig("identity.ktp_ocr_min_confidence", { lspId: batch.lspId }),
  ]);
  const scheme = schemes.find((s) => s.id === batch.schemeId) ?? null;
  const docColumns = resolveSchemeDocColumns(scheme);
  const ktpOcrMinConfidence =
    typeof configuredMinOcr === "number" && configuredMinOcr > 0 ? configuredMinOcr : 0.75;

  const userId = user.id;
  const batchId = batch.id;
  const batchLspId = batch.lspId;
  const driveFolderUrl = batch.driveFolderUrl;

  async function rescanBatchDriveAction() {
    "use server";
    if (!driveFolderUrl) return;
    const scan = await enqueueJob({
      userId,
      lspId: batchLspId,
      triggerAction: "rescan",
      type: "drive_scan",
      payload: { batchId, driveFolderUrl },
    });
    revalidatePath(`/batches/${batchId}`);
    if (scan.ok) {
      revalidatePath(`/batches/${batchId}/ingest/${scan.job.id}`);
    }
    revalidatePath(`/batches/${batchId}/triage`);
    revalidatePath("/batches");
    revalidatePath("/dashboard");
    revalidatePath("/settings/audit");
  }

  const rows: CompletenessRow[] = assessees.map((a) => {
    const aFiles = files.filter((f) => f.assesseeId === a.id);
    const docs: Record<string, "complete" | "warning" | "missing"> = {};
    for (const col of docColumns) {
      const key = col.toLowerCase().replace(/\./g, "").replace(/\s+/g, "_");
      const matching = aFiles.filter((f) =>
        key === "04b"
          ? f.docType === "04b" || f.docType === "dit_form"
          : f.docType === key,
      );
      const matched = pickLatestDriveFile(matching);
      docs[col] = matched
        ? matched.ocrConfidence !== null && matched.ocrConfidence < ktpOcrMinConfidence
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
  const unextractableCount = files.filter((f) => f.triageStatus === "unextractable").length;
  const active06bFile = files.find((f) => f.docType.toLowerCase() === "06b") ?? null;

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
              <RescanDriveButton batchId={batch.id} />
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

      {/* Permanent Drive Ingest Job Observability Card */}
      <div className="glass-card rounded-2xl p-5 space-y-3 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {latestJob?.status === "done" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : latestJob?.status === "failed" ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Status Pemindaian Drive (Ingest Job)
              </h2>
              <p className="text-xs font-mono text-slate-600 break-all mt-0.5">
                Ingest Job ID: {latestJob ? latestJob.id : "Belum ada job pindai"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <JobStatusPoller
              batchId={batch.id}
              jobId={latestJob?.id ?? null}
              initialStatus={latestJob?.status ?? null}
              initialProgress={latestJob?.progress ?? 0}
              mode="batch"
            />
            {latestJob && (
              <Link
                href={`/batches/${batch.id}/ingest/${latestJob.id}`}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Lihat Detail Job Ingest &amp; Log
              </Link>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <span>
            Ringkasan Hasil Pindai:{" "}
            <strong>
              {assessees.length} asesi terdeteksi · {files.length} berkas terpindai ·{" "}
              {unmatchedCount} perlu triase
            </strong>
            {unextractableCount > 0 && (
              <>
                {" · "}
                <Link
                  href={`/batches/${batch.id}/triage?status=unextractable`}
                  className="text-rose-700 font-semibold hover:underline"
                >
                  {unextractableCount} tidak bisa diproses
                </Link>
              </>
            )}
          </span>
          {latestJob && (
            <span className="text-slate-500 font-mono">
              Percobaan ke-{latestJob.attempts} · Diperbarui {latestJob.updatedAt}
            </span>
          )}
        </div>

        {latestJob?.status === "failed" && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1"
          >
            <p className="font-semibold">Error Worker Pemindaian Drive:</p>
            <p className="font-mono break-all">
              {latestJob.error || "Unknown worker error"}
            </p>
          </div>
        )}
      </div>

      {/* Batch-level 06B Master Answer Key Upload */}
      <BatchKeyUploadPanel
        batchId={batch.id}
        activeKeyFileName={active06bFile?.fileName ?? null}
        activeKeySource={active06bFile?.drivePath ?? null}
      />

      {/* Completeness Matrix */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Users className="w-4 h-4 text-teal-700" />
          Matriks Kelengkapan Berkas Asesi ({assessees.length} Asesi · {files.length} Berkas Drive)
        </div>
        <CompletenessMatrix batchId={batch.id} docColumns={docColumns} rows={rows} />
      </div>
    </div>
  );
}
