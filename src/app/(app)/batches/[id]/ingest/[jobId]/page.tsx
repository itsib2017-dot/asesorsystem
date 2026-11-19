import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { listAuditLogsForResource } from "@/repositories/audit.repository";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { getLatestJobForBatch } from "@/repositories/jobs.repository";
import { executeJob, getJobStatus } from "@/worker/queue";

export const metadata = {
  title: "Status Pemindaian Drive — AsesorKompetensi",
};

export default async function BatchIngestJobPage({
  params,
}: {
  params: Promise<{ id: string; jobId: string }>;
}) {
  const user = await getUser();
  if (!user) return notFound();

  const { id: batchId, jobId } = await params;
  const batch = await getBatchById(user.id, batchId);
  if (!batch) return notFound();

  const job = await getJobStatus(user.id, jobId);
  const belongsToBatch = job
    ? !job.payload?.batchId || String(job.payload.batchId) === batchId
    : false;

  if (!job || !belongsToBatch) {
    const latestJob = await getLatestJobForBatch(user.id, batchId);
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-5">
        <Link
          href={`/batches/${batchId}`}
          className="text-xs text-teal-700 hover:underline inline-block"
        >
          &larr; Kembali ke Batch {batch.name}
        </Link>
        <div
          role="alert"
          className="glass-card rounded-2xl p-6 border border-rose-200 bg-rose-50/70 space-y-3"
        >
          <div className="flex items-center gap-2.5 text-rose-800">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <h1 className="text-lg font-bold">Job tidak ditemukan</h1>
          </div>
          <p className="text-sm text-rose-900">
            Job ID <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200">{jobId}</code> tidak ditemukan pada batch{" "}
            <strong>{batch.name}</strong>.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/batches/${batchId}`}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-medium text-white"
            >
              Kembali ke Detail Batch
            </Link>
            {latestJob && (
              <Link
                href={`/batches/${batchId}/ingest/${latestJob.id}`}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-xs font-medium text-white"
              >
                Buka Job Pindai Terbaru ({latestJob.status})
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const [files, jobLogs] = await Promise.all([
    listDriveFilesForBatch(user.id, batchId),
    listAuditLogsForResource(user.id, batch.lspId, "jobs", job.id, 30),
  ]);
  const userId = user.id;
  const batchLspId = batch.lspId;

  async function retryJobAction() {
    "use server";
    await executeJob(userId, jobId, { lspId: batchLspId, triggerAction: "retry" });
    revalidatePath(`/batches/${batchId}/ingest/${jobId}`);
    revalidatePath(`/batches/${batchId}/triage`);
    revalidatePath(`/batches/${batchId}`);
    revalidatePath("/settings/audit");
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={`/batches/${batchId}`}
            className="text-xs text-teal-700 hover:underline"
          >
            &larr; Kembali ke Batch {batch.name}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Pemindaian &amp; Ingest Berkas Drive
          </h1>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            JOB ID: {job.id} · TIPE: {job.type}
          </p>
        </div>

        <form action={retryJobAction}>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Jalankan Ulang Pemindaian
          </button>
        </form>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {job.status === "done" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : job.status === "failed" ? (
              <XCircle className="w-5 h-5 text-rose-600" />
            ) : (
              <Clock className="w-5 h-5 text-amber-600" />
            )}
            <div>
              <div className="text-sm font-semibold text-slate-900 capitalize">
                Status: {job.status}
              </div>
              <div className="text-xs text-slate-500">
                Percobaan ke-{job.attempts} · Diperbarui {job.updatedAt}
              </div>
            </div>
          </div>
          <span className="font-mono text-sm font-bold text-slate-800">
            {job.progress}%
          </span>
        </div>

        <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full transition-all ${
              job.status === "failed"
                ? "bg-rose-600"
                : job.status === "done"
                  ? "bg-emerald-600"
                  : "bg-teal-600"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
          />
        </div>

        {job.error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1"
          >
            <p className="font-semibold">Pesan Kesalahan Worker:</p>
            <p className="font-mono break-all">{job.error}</p>
          </div>
        )}

        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>
            Total berkas Drive terindeks di batch ini:{" "}
            <strong className="text-slate-900">{files.length} berkas</strong>
          </span>
          <div className="flex gap-2">
            <Link
              href={`/batches/${batchId}/triage`}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 font-medium text-slate-800"
            >
              Buka Triage Berkas
            </Link>
            <Link
              href={`/batches/${batchId}`}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 font-medium text-white"
            >
              Lihat Matriks Batch
            </Link>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Log Eksekusi Job
          </h2>
          <span className="text-xs font-mono text-slate-500">
            {jobLogs.length} entri
          </span>
        </div>
        {jobLogs.length === 0 ? (
          <p className="text-xs text-slate-500">
            Belum ada log untuk job ini.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 text-xs">
            {jobLogs.map((entry) => (
              <li key={entry.id} className="py-2.5 flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900">
                    {entry.action}
                  </div>
                  <div className="text-slate-600">
                    Aktor: {entry.actorName || "Sistem"} · corr:{" "}
                    <span className="font-mono text-[11px]">{entry.correlationId}</span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  {entry.createdAt}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
