"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Lock, Play, Upload } from "lucide-react";
import { runWrittenGradingWithKeyAction } from "../actions";

interface WrittenKeyFormProps {
  batchId: string;
  assesseeId: string;
  activeKeyFileName: string | null;
  activeKeySourceLabel: string | null;
  activeKeyValidationSummary: string | null;
  isBatchKeyReady: boolean;
  blockingWarning: string | null;
  initialMasterKeyText: string;
  initialStudentAnswerText: string;
}

export function WrittenKeyForm({
  batchId,
  assesseeId,
  activeKeyFileName,
  activeKeySourceLabel,
  activeKeyValidationSummary,
  isBatchKeyReady,
  blockingWarning,
  initialMasterKeyText,
  initialStudentAnswerText,
}: WrittenKeyFormProps) {
  const router = useRouter();
  const [masterKeyText, setMasterKeyText] = useState(initialMasterKeyText);
  const [studentAnswerText, setStudentAnswerText] = useState(initialStudentAnswerText);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const canSubmit = isBatchKeyReady || Boolean(file) || masterKeyText.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setStatus({
        type: "error",
        text:
          blockingWarning ??
          "Belum ada kunci jawaban 06B yang valid dan aktif untuk menjalankan koreksi tertulis.",
      });
      return;
    }

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
      if (password.length > 0) {
        fd.append("masterKeyPassword", password);
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
        setPassword("");
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
      {!isBatchKeyReady && blockingWarning ? (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-900">
              Belum Ada Kunci Jawaban 06B Kerja yang Aktif — Koreksi Diblokir
            </p>
            <p className="leading-relaxed">{blockingWarning}</p>
          </div>
        </div>
      ) : (
        activeKeyFileName && (
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <div>
                Kunci aktif terverifikasi: <strong className="break-words">{activeKeyFileName}</strong>
                {activeKeySourceLabel && ` (${activeKeySourceLabel})`}
              </div>
              {activeKeyValidationSummary && (
                <div className="text-emerald-800">{activeKeyValidationSummary}</div>
              )}
            </div>
          </div>
        )
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="masterKeyFile"
            className="block text-xs font-semibold text-slate-700"
          >
            Unggah Berkas Kunci 06B Kerja (.docx / .txt){" "}
            {activeKeyFileName && isBatchKeyReady && (
              <span className="font-mono text-emerald-700 font-normal">
                (Aktif di batch: {activeKeyFileName})
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

        <div className="space-y-2">
          <div>
            <label
              htmlFor="masterKeyPassword"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Kata Sandi Berkas 06B (Opsional — jika .docx diproteksi)
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 focus-within:ring-2 focus-within:ring-teal-600">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                id="masterKeyPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                placeholder="Kosongkan jika file tidak dikunci sandi..."
                className="w-full text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-200 text-xs font-medium text-white inline-flex items-center gap-2 cursor-pointer"
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
            placeholder="Tempel teks kunci jawaban 06B kerja di sini jika belum mengunggah file .docx..."
            className="w-full rounded-xl bg-white border border-slate-300 p-3 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
        <div>
          <label
            htmlFor="studentAnswerText"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Teks Jawaban Asesi (06C)
            {studentAnswerText.trim() !== initialStudentAnswerText.trim() && (
              <span className="ml-2 text-[11px] font-normal text-amber-700">
                (Diedit manual — tercatat di audit log)
              </span>
            )}
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
