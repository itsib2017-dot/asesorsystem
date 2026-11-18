"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Upload } from "lucide-react";
import { runWrittenGradingWithKeyAction } from "../actions";

interface WrittenKeyFormProps {
  batchId: string;
  assesseeId: string;
  initialMasterKeyFileName: string | null;
  initialMasterKeyText: string;
  initialStudentAnswerText: string;
}

export function WrittenKeyForm({
  batchId,
  assesseeId,
  initialMasterKeyFileName,
  initialMasterKeyText,
  initialStudentAnswerText,
}: WrittenKeyFormProps) {
  const router = useRouter();
  const [masterKeyText, setMasterKeyText] = useState(initialMasterKeyText);
  const [studentAnswerText, setStudentAnswerText] = useState(initialStudentAnswerText);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const fd = new FormData();
      fd.append("batchId", batchId);
      fd.append("assesseeId", assesseeId);
      fd.append("masterKeyText", masterKeyText);
      fd.append("studentAnswerText", studentAnswerText);
      if (file) {
        fd.append("masterKeyFile", file);
      }

      const res = await runWrittenGradingWithKeyAction(fd);
      if (!res.ok) {
        setStatus({
          type: "error",
          text: res.error ?? "Gagal memproses koreksi tertulis.",
        });
      } else {
        setStatus({
          type: "success",
          text: res.message ?? "Penilaian tertulis selesai.",
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
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="masterKeyFile"
            className="block text-xs font-semibold text-slate-700"
          >
            Unggah Berkas Kunci 06B (.docx / .txt){" "}
            {initialMasterKeyFileName && (
              <span className="font-mono text-emerald-700 font-normal">
                (Aktif di batch: {initialMasterKeyFileName})
              </span>
            )}
          </label>
          <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 hover:border-teal-600 text-xs text-slate-700 cursor-pointer">
            <Upload className="w-4 h-4 text-teal-700 shrink-0" />
            <span className="truncate">
              {file ? file.name : "Pilih file FR.IA.06B.docx atau .txt..."}
            </span>
            <input
              id="masterKeyFile"
              type="file"
              accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-xs font-medium text-white inline-flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            {submitting
              ? "Memproses Kunci & Koreksi AI..."
              : "Simpan Kunci 06B & Jalankan Koreksi Tertulis"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="masterKeyText"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Pratinjau / Teks Kunci Jawaban Master (06B)
          </label>
          <textarea
            id="masterKeyText"
            rows={4}
            value={masterKeyText}
            onChange={(e) => setMasterKeyText(e.target.value)}
            placeholder="Tempel teks kunci 06B di sini jika belum mengunggah file .docx..."
            className="w-full rounded-xl bg-white border border-slate-300 p-3 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
        <div>
          <label
            htmlFor="studentAnswerText"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Teks Jawaban Asesi (06C)
          </label>
          <textarea
            id="studentAnswerText"
            rows={4}
            value={studentAnswerText}
            onChange={(e) => setStudentAnswerText(e.target.value)}
            placeholder="Terisi otomatis dari ekstrak berkas 06C, atau isi manual..."
            className="w-full rounded-xl bg-white border border-slate-300 p-3 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
      </div>

      {status && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-xl text-xs border ${
            status.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {status.text}
        </div>
      )}
    </form>
  );
}
