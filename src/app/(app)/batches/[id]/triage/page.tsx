import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/get-session";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { assignDriveFileAction } from "./actions";

export const metadata = {
  title: "Triage Berkas Drive — AsesorKompetensi",
};

const DOC_TYPE_OPTIONS = [
  { value: "ktp", label: "KTP" },
  { value: "apl01", label: "FR.APL.01" },
  { value: "apl02", label: "FR.APL.02" },
  { value: "04a", label: "FR.IA.04A (DIT)" },
  { value: "04b", label: "FR.IA.04B (Presentasi)" },
  { value: "06a", label: "FR.IA.06A (Soal)" },
  { value: "06b", label: "FR.IA.06B (Kunci)" },
  { value: "06c", label: "FR.IA.06C (Jawaban)" },
  { value: "09", label: "FR.IA.09 (Wawancara)" },
  { value: "ijazah", label: "Ijazah" },
  { value: "cv", label: "CV" },
  { value: "surat_tugas", label: "Surat Tugas / SK Kerja" },
  { value: "portofolio", label: "Portofolio" },
  { value: "pas_foto", label: "Pas Foto" },
  { value: "sertifikat_pelatihan", label: "Sertifikat Pelatihan" },
  { value: "materi_pelatihan", label: "Materi Pelatihan (Tidak Dipakai)" },
  { value: "unknown", label: "unknown" },
] as const;

const PAGE_SIZE = 30;

function buildTriageUrl(
  batchId: string,
  params: { q: string; status: string; docType: string; page: number },
): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.docType) sp.set("docType", params.docType);
  if (params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/batches/${batchId}/triage?${qs}` : `/batches/${batchId}/triage`;
}

export default async function TriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string; docType?: string; page?: string }>;
}) {
  const user = await getUser();
  if (!user) return notFound();

  const { id } = await params;
  const sp = await searchParams;
  const batch = await getBatchById(user.id, id);
  if (!batch) return notFound();

  const [files, assessees] = await Promise.all([
    listDriveFilesForBatch(user.id, id),
    listAssesseesByBatch(user.id, id),
  ]);

  const q = (sp.q ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();
  const docTypeFilter = (sp.docType ?? "").trim();
  const qLower = q.toLowerCase();

  const filtered = files.filter((f) => {
    if (
      qLower &&
      !f.fileName.toLowerCase().includes(qLower) &&
      !f.drivePath.toLowerCase().includes(qLower)
    ) {
      return false;
    }
    if (statusFilter && f.triageStatus !== statusFilter) return false;
    if (docTypeFilter && f.docType !== docTypeFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const parsedPage = Number(sp.page ?? "1");
  const currentPage =
    Number.isFinite(parsedPage) && parsedPage >= 1
      ? Math.min(Math.floor(parsedPage), totalPages)
      : 1;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageFiles = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/batches/${id}`} className="text-xs text-teal-700 hover:underline">
            &larr; Kembali ke Batch
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Antrean Triage Berkas ({batch.name})
          </h1>
          <p className="text-sm text-slate-500">
            Petakan file Google Drive ke asesi dan perbaiki jenis dokumen (docType) maupun status triase.
          </p>
        </div>
        <div className="text-xs text-slate-600 font-mono">
          Total: {files.length} berkas · Terfilter: {filtered.length}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <form
        method="GET"
        className="glass-card rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label htmlFor="q" className="block text-xs font-semibold text-slate-700 mb-1">
            Cari Nama / Jalur Berkas
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Mis. KTP, Tugas DIT, nama asesi..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-xs font-semibold text-slate-700 mb-1">
            Status Triase
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusFilter}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
          >
            <option value="">Semua Status</option>
            <option value="unmatched">unmatched</option>
            <option value="assigned">assigned</option>
            <option value="not_needed">not_needed</option>
          </select>
        </div>

        <div>
          <label htmlFor="docTypeFilter" className="block text-xs font-semibold text-slate-700 mb-1">
            Jenis Dokumen
          </label>
          <select
            id="docTypeFilter"
            name="docType"
            defaultValue={docTypeFilter}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
          >
            <option value="">Semua Jenis</option>
            {DOC_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value} — {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium cursor-pointer"
          >
            Terapkan
          </button>
          {(q || statusFilter || docTypeFilter) && (
            <Link
              href={`/batches/${id}/triage`}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-slate-600">
          {files.length === 0
            ? "Belum ada berkas yang dipindai pada batch ini."
            : "Tidak ada berkas yang cocok dengan filter pencarian."}
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-600">
              <tr>
                <th className="py-3 px-4">Nama Berkas / Jalur Drive</th>
                <th className="py-3 px-4">Pemetaan Asesi, Jenis Dokumen &amp; Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pageFiles.map((f) => {
                const hasPresetDocType = DOC_TYPE_OPTIONS.some((o) => o.value === f.docType);
                return (
                  <tr key={f.id} className="align-top">
                    <td className="py-3 px-4 max-w-md">
                      <div className="font-medium text-slate-900 break-words">{f.fileName}</div>
                      <div className="text-xs text-slate-400 font-mono break-all">
                        {f.drivePath}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <form action={assignDriveFileAction} className="flex flex-wrap gap-2 items-center">
                        <input type="hidden" name="batchId" value={id} />
                        <input type="hidden" name="fileId" value={f.id} />

                        <select
                          aria-label={`Jenis dokumen ${f.fileName}`}
                          name="docType"
                          defaultValue={f.docType}
                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-mono"
                        >
                          {!hasPresetDocType && (
                            <option value={f.docType}>{f.docType}</option>
                          )}
                          {DOC_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.value} ({opt.label})
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label={`Status triase ${f.fileName}`}
                          name="triageStatus"
                          defaultValue={
                            f.triageStatus === "not_needed" || f.triageStatus === "unmatched"
                              ? f.triageStatus
                              : "assigned"
                          }
                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                        >
                          <option value="assigned">assigned</option>
                          <option value="unmatched">unmatched</option>
                          <option value="not_needed">not_needed</option>
                        </select>

                        <select
                          aria-label={`Asesi untuk ${f.fileName}`}
                          name="assesseeId"
                          defaultValue={f.assesseeId ?? ""}
                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white max-w-[200px]"
                        >
                          <option value="">-- Tidak terpetakan --</option>
                          {assessees.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.displayName}
                            </option>
                          ))}
                        </select>

                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium cursor-pointer"
                        >
                          Tetapkan
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            Halaman {currentPage} dari {totalPages} (menampilkan {startIdx + 1}–
            {Math.min(startIdx + PAGE_SIZE, filtered.length)} dari {filtered.length})
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={buildTriageUrl(id, {
                  q,
                  status: statusFilter,
                  docType: docTypeFilter,
                  page: currentPage - 1,
                })}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
              >
                &larr; Sebelumnya
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={buildTriageUrl(id, {
                  q,
                  status: statusFilter,
                  docType: docTypeFilter,
                  page: currentPage + 1,
                })}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
              >
                Berikutnya &rarr;
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
