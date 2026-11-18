"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Upload } from "lucide-react";
import { uploadBatchMasterKey06bAction } from "@/app/(app)/batches/[id]/actions";

interface BatchKeyUploadPanelProps {
  batchId: string;
  activeKeyFileName: string | null;
  activeKeySource: string | null;
}

export function BatchKeyUploadPanel({
  batchId,
  activeKeyFileName,
  activeKeySource,
}: BatchKeyUploadPanelProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus({
        type: "error",
        text: "Pilih berkas FR.IA.06B (.docx atau .txt) terlebih dahulu.",
      });
      return;
    }

    setUploading(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("batchId", batchId);
      fd.append("masterKeyFile", file);
      const res = await uploadBatchMasterKey06bAction(fd);
      if (!res.ok) {
        setStatus({
          type: "error",
          text: res.error || "Gagal mengunggah kunci jawaban 06B.",
        });
      } else {
        setStatus({
          type: "success",
          text: `Kunci 06B "${res.fileName}" tersimpan untuk seluruh asesi batch ini.`,
        });
        setFile(null);
        router.refresh();
      }
    } catch (err) {
      setStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan jaringan.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Kunci Jawaban Tertulis (FR.IA.06B)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Unggah berkas kunci FR.IA.06B (.docx / .txt) sekali per batch untuk dipakai pada seluruh penilaian tertulis asesi.
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
            activeKeyFileName
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          {activeKeyFileName
            ? `Aktif: ${activeKeyFileName}`
            : "Belum ada berkas 06B di batch"}
        </span>
      </div>

      {activeKeySource && (
        <div className="text-[11px] font-mono text-slate-500 break-all">
          Sumber: {activeKeySource}
        </div>
      )}

      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:border-teal-600 text-xs text-slate-700 cursor-pointer">
          <Upload className="w-3.5 h-3.5 text-teal-700 shrink-0" />
          <span className="truncate max-w-xs">
            {file ? file.name : "Pilih file FR.IA.06B (.docx / .txt)..."}
          </span>
          <input
            type="file"
            accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>

        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
        >
          {uploading ? "Mengunggah..." : "Simpan Kunci 06B Batch"}
        </button>
      </form>

      {status && (
        <div
          role="status"
          className={`p-3 rounded-xl text-xs border ${
            status.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {status.text}
        </div>
      )}
    </div>
  );
}
