"use client";
// Client interactivity required for batch metadata editing and optional Surat Tugas file preview/upload.

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Edit3, FileText, Upload } from "lucide-react";
import type { ParsedSuratTugasResult } from "@/services/surat-tugas";
import {
  parseSuratTugasPreviewAction,
  updateBatchMetadataAction,
  uploadBatchSuratTugasAction,
} from "../actions";

interface BatchMetadataSuratTugasPanelProps {
  batch: {
    id: string;
    name: string;
    schemeId: string;
    tukName: string | null;
    tukType: string | null;
    assessmentDate: string | null;
    driveFolderUrl: string | null;
    kelompokSheetUrl: string | null;
  };
  schemes: Array<{ id: string; code: string; name: string }>;
  existingSuratTugasFiles: Array<{ id: string; fileName: string; triageStatus: string }>;
}

export function BatchMetadataSuratTugasPanel({
  batch,
  schemes,
  existingSuratTugasFiles,
}: BatchMetadataSuratTugasPanelProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const [name, setName] = useState(batch.name);
  const [schemeId, setSchemeId] = useState(batch.schemeId);
  const [tukName, setTukName] = useState(batch.tukName ?? "");
  const [tukType, setTukType] = useState<"sewaktu" | "tempat_kerja" | "mandiri">(
    batch.tukType === "tempat_kerja" || batch.tukType === "mandiri"
      ? batch.tukType
      : "sewaktu",
  );
  const [assessmentDate, setAssessmentDate] = useState(batch.assessmentDate ?? "");
  const [driveFolderUrl, setDriveFolderUrl] = useState(batch.driveFolderUrl ?? "");
  const [kelompokSheetUrl, setKelompokSheetUrl] = useState(batch.kelompokSheetUrl ?? "");

  const [savingMeta, setSavingMeta] = useState(false);
  const [metaMsg, setMetaMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsingSt, setParsingSt] = useState(false);
  const [uploadingSt, setUploadingSt] = useState(false);
  const [preview, setPreview] = useState<ParsedSuratTugasResult | null>(null);
  const [applyMetadata, setApplyMetadata] = useState(true);
  const [importCandidates, setImportCandidates] = useState(true);
  const [stMsg, setStMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingMeta) return;
    setSavingMeta(true);
    setMetaMsg(null);
    try {
      const fd = new FormData();
      fd.set("batchId", batch.id);
      fd.set("name", name);
      fd.set("schemeId", schemeId);
      fd.set("tukName", tukName);
      fd.set("tukType", tukType);
      fd.set("assessmentDate", assessmentDate);
      fd.set("driveFolderUrl", driveFolderUrl);
      fd.set("kelompokSheetUrl", kelompokSheetUrl);
      const res = await updateBatchMetadataAction(fd);
      if (!res.ok) {
        setMetaMsg({ type: "error", text: res.error ?? "Gagal memperbarui batch." });
        return;
      }
      setMetaMsg({ type: "success", text: res.message ?? "Metadata batch diperbarui." });
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      setMetaMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan jaringan.",
      });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreview(null);
    setStMsg(null);
    if (!file) return;

    setParsingSt(true);
    try {
      const fd = new FormData();
      fd.set("batchId", batch.id);
      fd.set("suratTugasFile", file);
      const res = await parseSuratTugasPreviewAction(fd);
      if (!res.ok) {
        setStMsg({ type: "error", text: res.error ?? "Surat Tugas tidak dapat dibaca." });
        return;
      }
      if (res.parsed) {
        setPreview(res.parsed);
      }
    } catch (err) {
      setStMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal membaca pratinjau Surat Tugas.",
      });
    } finally {
      setParsingSt(false);
    }
  };

  const handleUploadSuratTugas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || uploadingSt) return;
    setUploadingSt(true);
    setStMsg(null);
    try {
      const fd = new FormData();
      fd.set("batchId", batch.id);
      fd.set("suratTugasFile", selectedFile);
      fd.set("applyMetadata", applyMetadata ? "true" : "false");
      fd.set("importCandidates", importCandidates ? "true" : "false");
      if (preview?.assessmentDate) fd.set("assessmentDate", preview.assessmentDate);
      if (preview?.tukName) fd.set("tukName", preview.tukName);

      const res = await uploadBatchSuratTugasAction(fd);
      if (!res.ok) {
        setStMsg({ type: "error", text: res.error ?? "Gagal mengunggah Surat Tugas." });
        return;
      }
      if (applyMetadata && res.parsed?.assessmentDate && !assessmentDate) {
        setAssessmentDate(res.parsed.assessmentDate);
      }
      if (applyMetadata && res.parsed?.tukName && !tukName) {
        setTukName(res.parsed.tukName);
      }
      setStMsg({ type: "success", text: res.message ?? "Surat Tugas tersimpan." });
      setSelectedFile(null);
      setPreview(null);
      router.refresh();
    } catch (err) {
      setStMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengunggah Surat Tugas.",
      });
    } finally {
      setUploadingSt(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-200 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-700" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Metadata Batch &amp; Surat Tugas (Opsional)
            </h2>
            <p className="text-xs text-slate-500">
              Sunting tanggal asesmen, TUK, skema, atau unggah Surat Tugas untuk isi otomatis tanggal &amp; daftar peserta.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" />
          {editOpen ? "Tutup Edit Batch" : "Edit Metadata Batch"}
        </button>
      </div>

      {metaMsg && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            metaMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {metaMsg.text}
        </div>
      )}

      {editOpen && (
        <form onSubmit={handleSaveMetadata} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Nama Batch
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Skema Sertifikasi
              </label>
              <select
                value={schemeId}
                onChange={(e) => setSchemeId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tanggal Asesmen (YYYY-MM-DD)
              </label>
              <input
                type="date"
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Nama TUK
              </label>
              <input
                type="text"
                value={tukName}
                onChange={(e) => setTukName(e.target.value)}
                placeholder="TUK Sewaktu / Instansi..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Jenis TUK
              </label>
              <select
                value={tukType}
                onChange={(e) =>
                  setTukType(e.target.value as "sewaktu" | "tempat_kerja" | "mandiri")
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="sewaktu">Sewaktu</option>
                <option value="tempat_kerja">Tempat Kerja</option>
                <option value="mandiri">Mandiri</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tautan Drive Folder
              </label>
              <input
                type="url"
                value={driveFolderUrl}
                onChange={(e) => setDriveFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Tautan Google Sheet Kelompok Asesi (Opsional)
            </label>
            <input
              type="url"
              value={kelompokSheetUrl}
              onChange={(e) => setKelompokSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-mono"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingMeta}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
            >
              {savingMeta ? "Menyimpan..." : "Simpan Perubahan Batch"}
            </button>
          </div>
        </form>
      )}

      {/* Optional Surat Tugas Upload & Auto-Parse */}
      <form onSubmit={handleUploadSuratTugas} className="pt-2 border-t border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <FileText className="w-4 h-4 text-slate-500" />
            <span>
              Unggah Surat Tugas (.pdf, .docx, .txt · maks 10 MB)
              {existingSuratTugasFiles.length > 0 && (
                <span className="ml-2 text-emerald-700 font-semibold">
                  · {existingSuratTugasFiles.length} berkas tercatat (
                  {existingSuratTugasFiles[0]?.fileName})
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileChange}
            className="text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
          />
          {selectedFile && (
            <button
              type="submit"
              disabled={uploadingSt || parsingSt}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploadingSt ? "Menyimpan Surat Tugas..." : "Simpan Surat Tugas"}
            </button>
          )}
        </div>

        {parsingSt && (
          <p className="text-xs text-slate-500">Membaca dan mengekstrak data Surat Tugas...</p>
        )}

        {preview && (
          <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-xs space-y-2">
            <div className="font-semibold text-teal-900">
              Hasil Ekstraksi Surat Tugas:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-slate-700">
              <div>
                <span className="text-slate-500">No. Surat:</span>{" "}
                <strong>{preview.letterNumber ?? "-"}</strong>
              </div>
              <div>
                <span className="text-slate-500">Tanggal Asesmen:</span>{" "}
                <strong>{preview.assessmentDate ?? "-"}</strong>
              </div>
              <div>
                <span className="text-slate-500">TUK:</span>{" "}
                <strong>{preview.tukName ?? "-"}</strong>
              </div>
              <div>
                <span className="text-slate-500">Asesor:</span>{" "}
                <strong>{preview.assessorName ?? "-"}</strong>
              </div>
            </div>
            {preview.candidateNames.length > 0 && (
              <div className="text-slate-700">
                <span className="text-slate-500">
                  Peserta terdeteksi ({preview.candidateNames.length}):
                </span>{" "}
                {preview.candidateNames.slice(0, 8).join(", ")}
                {preview.candidateNames.length > 8 ? ` (+${preview.candidateNames.length - 8} lainnya)` : ""}
              </div>
            )}
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyMetadata}
                  onChange={(e) => setApplyMetadata(e.target.checked)}
                />
                Terapkan tanggal asesmen &amp; TUK ke metadata batch
              </label>
              {preview.candidateNames.length > 0 && (
                <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importCandidates}
                    onChange={(e) => setImportCandidates(e.target.checked)}
                  />
                  Tambahkan {preview.candidateNames.length} peserta ke roster asesi
                </label>
              )}
            </div>
          </div>
        )}

        {stMsg && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              stMsg.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {stMsg.text}
          </div>
        )}
      </form>
    </div>
  );
}
