import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { listAuditLogsForResource } from "@/repositories/audit.repository";
import {
  getBatchById,
  listBatchRosterNotes,
  listDriveFilesForBatch,
} from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import {
  addBatchRosterNoteAction,
  addAssesseeFormAction,
  assignDriveFileAction,
  importRosterFormAction,
  reclassifyBatchContentAction,
} from "./actions";
import { ExtractFileTrigger } from "./extract-file-trigger";
import { AssesseeActions } from "./assessee-actions";

import { explainNameInference } from "@/services/drive";

export const metadata = {
  title: "Triage Berkas Drive — AsesorKompetensi",
};

const DOC_TYPE_OPTIONS = [
  { value: "ktp", label: "KTP" },
  { value: "apl01", label: "FR.APL.01" },
  { value: "apl02", label: "FR.APL.02" },
  { value: "04a", label: "FR.IA.04A (Instruksi DIT)" },
  { value: "04b", label: "FR.IA.04B (Presentasi / Tugas DIT)" },
  { value: "dit_form", label: "Formulir Pendukung Tugas DIT (IBPR/ERP/Permit/Inspeksi)" },
  { value: "06a", label: "FR.IA.06A (Soal)" },
  { value: "06b", label: "FR.IA.06B (Kunci)" },
  { value: "06c", label: "FR.IA.06C (Jawaban)" },
  { value: "09", label: "FR.IA.09 (Wawancara)" },
  { value: "ijazah", label: "Ijazah" },
  { value: "cv", label: "CV" },
  { value: "surat_tugas", label: "Surat Tugas / SK Kerja" },
  { value: "portofolio", label: "Portofolio Pengalaman Kerja" },
  { value: "pas_foto", label: "Pas Foto" },
  { value: "sertifikat_pelatihan", label: "Sertifikat Pelatihan" },
  { value: "materi_pelatihan", label: "Materi Pelatihan (Tidak Dipakai)" },
  { value: "template_muk", label: "Template / Administrasi MUK (Tidak Dipakai)" },
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

  const [files, assessees, batchAuditLogs, rosterNotes] = await Promise.all([
    listDriveFilesForBatch(user.id, id),
    listAssesseesByBatch(user.id, id),
    listAuditLogsForResource(user.id, batch.lspId, "batches", id, 10),
    listBatchRosterNotes(user.id, id),
  ]);

  const rosterAuditEntries = batchAuditLogs.filter(
    (entry) => entry.action === "batch.roster.reconciled",
  );
  const unmatchedCount = files.filter((f) => f.triageStatus === "unmatched").length;
  const unextractableCount = files.filter((f) => f.triageStatus === "unextractable").length;

  const q = (sp.q ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();
  const docTypeFilter = (sp.docType ?? "").trim();
  const qLower = q.toLowerCase();

  const filtered = files.filter((f) => {
    if (
      qLower &&
      !(f.fileName ?? "").toLowerCase().includes(qLower) &&
      !(f.drivePath ?? "").toLowerCase().includes(qLower)
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-600 font-mono">
            Total: {files.length} · Belum terpetakan: {unmatchedCount}
            {unextractableCount > 0 ? ` · Tidak bisa diproses: ${unextractableCount}` : ""} · Terfilter: {filtered.length}
          </span>
          <form action={reclassifyBatchContentAction}>
            <input type="hidden" name="batchId" value={id} />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-white border border-teal-700 text-teal-800 hover:bg-teal-50 text-xs font-medium cursor-pointer"
            >
              Deteksi Ulang Isi Berkas (Unknown / Ambigu)
            </button>
          </form>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 border border-teal-200 bg-teal-50/50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-900">
            Jejak Penyelarasan Daftar Asesi
          </h2>
          <Link
            href="/settings/audit"
            className="text-xs text-teal-700 hover:underline font-medium"
          >
            Lihat Log Audit Lengkap &rarr;
          </Link>
        </div>

        {rosterAuditEntries.length === 0 && rosterNotes.length === 0 ? (
          <p className="text-xs text-slate-600">
            Belum ada perubahan daftar asesi otomatis maupun catatan penyelarasan manual pada batch ini.
          </p>
        ) : (
          <ul className="space-y-2 text-xs text-slate-800">
            {rosterAuditEntries.slice(0, 5).map((entry) => {
              const summary = entry.afterSummary ?? {};
              const changeText =
                typeof summary.rosterChangeSummary === "string"
                  ? summary.rosterChangeSummary
                  : "Daftar asesi diselaraskan terhadap folder otoritatif.";
              const beforeCount =
                typeof summary.beforeCount === "number" ? summary.beforeCount : null;
              const afterCount =
                typeof summary.afterCount === "number" ? summary.afterCount : null;
              return (
                <li
                  key={`audit-${entry.id}`}
                  className="bg-white/90 border border-teal-100 rounded-xl px-3.5 py-2.5 space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-900 border border-teal-200">
                      Log Sistem (Otomatis)
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {entry.createdAt}
                    </span>
                  </div>
                  <div className="leading-relaxed">
                    {beforeCount !== null && afterCount !== null && (
                      <span className="font-mono font-semibold text-teal-800 mr-2">
                        [{beforeCount} &rarr; {afterCount} asesi]
                      </span>
                    )}
                    <span>{changeText}</span>
                  </div>
                </li>
              );
            })}

            {rosterNotes.map((note) => (
              <li
                key={`note-${note.id}`}
                className="bg-amber-50/90 border border-amber-200 rounded-xl px-3.5 py-2.5 space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                    Catatan Non-Log Sistem
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {note.eventOccurredAt ?? note.createdAt}
                  </span>
                </div>
                <div className="leading-relaxed text-slate-900">
                  {note.beforeCount !== null && note.afterCount !== null && (
                    <span className="font-mono font-semibold text-amber-900 mr-2">
                      [{note.beforeCount} &rarr; {note.afterCount} asesi]
                    </span>
                  )}
                  <span>{note.summary}</span>
                </div>
                <div className="text-[11px] text-amber-900 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>
                    <strong>Sumber:</strong> {note.sourceLabel}
                  </span>
                  {note.referenceDoc && (
                    <span className="font-mono text-slate-600">
                      Ref: {note.referenceDoc}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <details className="pt-1">
          <summary className="text-[11px] font-medium text-teal-800 hover:underline cursor-pointer">
            + Catat Penyelarasan Roster di Luar Jalur Scan (Manual / Non-Scan)
          </summary>
          <form
            action={addBatchRosterNoteAction}
            className="mt-2 p-3 rounded-xl bg-white border border-teal-200 grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs"
          >
            <input type="hidden" name="batchId" value={id} />
            <div>
              <label htmlFor="rosterNoteBefore" className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Jumlah Sebelum
              </label>
              <input
                id="rosterNoteBefore"
                name="beforeCount"
                type="number"
                min={0}
                placeholder="Mis. 26"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label htmlFor="rosterNoteAfter" className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Jumlah Sesudah
              </label>
              <input
                id="rosterNoteAfter"
                name="afterCount"
                type="number"
                min={0}
                placeholder="Mis. 23"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="rosterNoteSource" className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Sumber Keterangan (Wajib Jujur)
              </label>
              <input
                id="rosterNoteSource"
                name="sourceLabel"
                type="text"
                required
                minLength={5}
                placeholder="Mis. Catatan manual asesor / penyesuaian TUK tanggal ..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="rosterNoteSummary" className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Penjelasan Perubahan Roster
              </label>
              <input
                id="rosterNoteSummary"
                name="summary"
                type="text"
                required
                minLength={10}
                placeholder="Jelaskan mengapa jumlah/daftar asesi berubah (tanpa menyalin data sensitif KTP/NIK)..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-medium cursor-pointer"
              >
                Simpan Catatan
              </button>
            </div>
          </form>
        </details>
      </div>

      {/* Roster Management: Tambah / Ubah / Hapus / Impor Asesi */}
      <div className="glass-card rounded-2xl p-4 border border-amber-200 bg-amber-25/50 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-700" />
          <h2 className="text-sm font-semibold text-slate-900">Kelola Daftar Asesi (Roster)</h2>
        </div>
        <p className="text-xs text-slate-600">
          Tambah asesi manual, impor dari Sheet Kelompok Asesi, atau ubah/hapus asesi yang salah
          terdeteksi. Semua perubahan tercatat di log audit.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tambah Asesi Manual */}
          <form action={addAssesseeFormAction} className="space-y-2 p-3 rounded-xl bg-white border border-slate-300">
            <input type="hidden" name="batchId" value={id} />
            <label className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider">
              Tambah Asesi Manual
            </label>
            <input
              name="displayName"
              type="text"
              required
              minLength={2}
              placeholder="Nama lengkap asesi"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            />
            <button
              type="submit"
              className="w-full px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium cursor-pointer"
            >
              Simpan
            </button>
          </form>

          {/* Impor dari Sheet */}
          <form action={importRosterFormAction} className="space-y-2 p-3 rounded-xl bg-white border border-slate-300">
            <input type="hidden" name="batchId" value={id} />
            <label className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider">
              Impor dari Sheet Kelompok Asesi
            </label>
            <input
              name="kelompokSheetUrl"
              type="url"
              required
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-mono"
            />
            <button
              type="submit"
              className="w-full px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium cursor-pointer"
            >
              Impor
            </button>
          </form>
        </div>

        {/* Daftar asesi saat ini */}
        {assessees.length === 0 ? (
          <p className="text-xs text-slate-500 text-center">
            Belum ada asesi di batch ini. Tambah asesi di atas atau impor dari Sheet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse divide-y divide-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-4 font-semibold text-slate-600">Nama Asesi</th>
                  <th className="py-2 px-4 font-semibold text-slate-600 text-center">Pseudonim</th>
                  <th className="py-2 px-4 font-semibold text-slate-600 text-center">Sertifikat</th>
                  <th className="py-2 px-4 font-semibold text-slate-600 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {assessees.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-4 font-medium text-slate-900">
                      {a.displayName}
                    </td>
                    <td className="py-2 px-4 text-center font-mono text-slate-500">
                      {a.pseudonym ?? "—"}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {a.certificateNameConfirmed ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Dikonfirmasi
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Belum
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-right space-x-1">
                      {!a.certificateNameConfirmed && (
                        <AssesseeActions
                          batchId={id}
                          assesseeId={a.id}
                          displayName={a.displayName}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <option value="unmatched">unmatched (Belum Terpetakan)</option>
            <option value="unextractable">unextractable (Tidak Bisa Diproses)</option>
            <option value="assigned">assigned (Terpetakan)</option>
            <option value="not_needed">not_needed (Tidak Dipakai)</option>
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
                <th className="py-3 px-4">Alasan Tanpa Kandidat Nama</th>
                <th className="py-3 px-4">Pemetaan Asesi, Jenis Dokumen &amp; Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pageFiles.map((f) => {
                const safeDocType = f.docType ?? "unknown";
                const hasPresetDocType = DOC_TYPE_OPTIONS.some((o) => o.value === safeDocType);
                return (
                  <tr key={f.id} className="align-top">
                    <td className="py-3 px-4 max-w-md">
                      <div className="font-medium text-slate-900 break-words flex flex-wrap items-center gap-1.5">
                        <span>{f.fileName}</span>
                        {safeDocType.toLowerCase() === "06b" && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              batch.activeMasterKeyFileId === f.id &&
                              batch.activeMasterKeyValidationStatus === "valid"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-amber-100 text-amber-900 border-amber-200"
                            }`}
                          >
                            {batch.activeMasterKeyFileId === f.id &&
                            batch.activeMasterKeyValidationStatus === "valid"
                              ? "Kunci 06B Aktif"
                              : "Tidak Aktif (Blanko/Kandidat)"}
                          </span>
                        )}
                        {f.triageStatus === "unextractable" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                            Tidak Bisa Diproses
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono break-all">
                        {f.drivePath}
                      </div>
                      {(f.triageReason || f.driveModifiedTime) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                          {f.triageReason && (
                            <span
                              className={`px-2 py-0.5 rounded ${
                                f.triageStatus === "unextractable"
                                  ? "bg-rose-50 text-rose-900 border border-rose-200"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {f.triageReason}
                            </span>
                          )}
                          {f.driveModifiedTime && (
                            <span className="font-mono text-slate-500">
                              Mod: {f.driveModifiedTime.slice(0, 10)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      {(() => {
                        const reason = f.drivePath ? explainNameInference(f.drivePath) : null;
                        if (!reason) return <span className="text-[10px] text-slate-400">—</span>;
                        return (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-200"
                            title={reason}
                          >
                            {reason.length > 60 ? `${reason.slice(0, 60)}…` : reason}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <form action={assignDriveFileAction} className="flex flex-wrap gap-2 items-center">
                        <input type="hidden" name="batchId" value={id} />
                        <input type="hidden" name="fileId" value={f.id} />

                        <select
                          aria-label={`Jenis dokumen ${f.fileName}`}
                          name="docType"
                          defaultValue={safeDocType}
                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-mono"
                        >
                          {!hasPresetDocType && (
                            <option value={safeDocType}>{safeDocType}</option>
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
                            f.triageStatus === "not_needed" ||
                            f.triageStatus === "unmatched" ||
                            f.triageStatus === "unextractable"
                              ? f.triageStatus
                              : "assigned"
                          }
                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                        >
                          <option value="assigned">assigned</option>
                          <option value="unmatched">unmatched</option>
                          <option value="unextractable">unextractable</option>
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
                      <ExtractFileTrigger
                        batchId={id}
                        fileId={f.id}
                        fileName={f.fileName}
                        mimeType={f.mimeType}
                        driveFileId={f.driveFileId}
                        hasExtractedText={Boolean(f.extractedText?.trim())}
                      />
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
