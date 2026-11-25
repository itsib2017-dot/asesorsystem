"use client";
// Client interactivity required to upload/save 06B master key, trigger async grading, and poll live Job ID progress.

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Play,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react";
import { formatWrittenJobFailureMessage } from "@/lib/jobs/format-written-error";
import { waitForJob } from "@/lib/jobs/wait-for-job";
import {
  runWrittenGradingWithKeyAction,
  saveWrittenMasterKeyAction,
} from "../actions";

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

  const [savingKey, setSavingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [runningGrading, setRunningGrading] = useState(false);
  const [activeJob, setActiveJob] = useState<{
    id: string;
    status: string;
    progress: number;
  } | null>(null);
  const [gradingStatus, setGradingStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const canSaveKey = Boolean(file) || masterKeyText.trim().length > 0;
  const busy = savingKey || runningGrading;

  const handleSaveKey = async () => {
    if (busy) return;
    if (!canSaveKey) {
      setKeyStatus({
        type: "error",
        text: "Unggah berkas kunci 06B (.docx/.txt) atau tempel teks kunci terlebih dahulu.",
      });
      return;
    }

    setSavingKey(true);
    setKeyStatus(null);

    try {
      const fd = new FormData();
      fd.append("batchId", batchId);
      fd.append("assesseeId", assesseeId);
      fd.append("masterKeyText", masterKeyText);
      if (file) {
        fd.append("masterKeyFile", file);
      }
      if (password.length > 0) {
        fd.append("masterKeyPassword", password);
      }

      const res = await saveWrittenMasterKeyAction(fd);
      if (!res.ok) {
        setKeyStatus({
          type: "error",
          text: res.error ?? "Gagal menyimpan kunci jawaban 06B.",
        });
      } else {
        setKeyStatus({
          type: "success",
          text: res.message ?? "Kunci 06B berhasil disimpan dan diaktifkan.",
        });
        if (typeof res.extractedText === "string" && res.extractedText.length > 0) {
          setMasterKeyText(res.extractedText);
        }
        setFile(null);
        setPassword("");
      }
      router.refresh();
    } catch (err) {
      setKeyStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat menyimpan kunci.",
      });
    } finally {
      setSavingKey(false);
    }
  };

  const handleRunGrading = async () => {
    if (!isBatchKeyReady || busy) {
      if (!isBatchKeyReady) {
        setGradingStatus({
          type: "error",
          text:
            blockingWarning ??
            "Belum ada kunci jawaban 06B yang valid dan aktif untuk menjalankan koreksi tertulis.",
        });
      }
      return;
    }

    setRunningGrading(true);
    setActiveJob(null);
    setGradingStatus(null);

    try {
      const fd = new FormData();
      fd.append("batchId", batchId);
      fd.append("assesseeId", assesseeId);
      fd.append("studentAnswerText", studentAnswerText);

      const res = await runWrittenGradingWithKeyAction(fd);
      if (!res.ok) {
        setGradingStatus({
          type: "error",
          text: res.jobId
            ? formatWrittenJobFailureMessage(res.jobId, res.error)
            : (res.error ?? "Gagal memulai koreksi tertulis."),
        });
        router.refresh();
        return;
      }

      const jobId = res.jobId;
      if (jobId) {
        setActiveJob({
          id: jobId,
          status: res.status ?? "pending",
          progress: Number(res.progress ?? 0),
        });
        const final = await waitForJob(jobId, undefined, {
          timeoutMs: 310_000,
          onProgress: ({ status, progress }) => {
            setActiveJob({ id: jobId, status, progress });
          },
        });
        if (final.status !== "done") {
          setGradingStatus({
            type: "error",
            text:
              final.status === "failed"
                ? formatWrittenJobFailureMessage(jobId, final.error)
                : `Koreksi tertulis masih berjalan atau melewati batas waktu tunggu (Job ${jobId}). Periksa Status Job pada halaman batch lalu segarkan halaman.`,
          });
          router.refresh();
          return;
        }
      }

      setGradingStatus({
        type: "success",
        text: `Koreksi tertulis selesai (Job ${jobId ?? "-"}).`,
      });
      router.refresh();
    } catch (err) {
      setGradingStatus({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan jaringan saat menjalankan koreksi tertulis.",
      });
      router.refresh();
    } finally {
      setRunningGrading(false);
      setActiveJob(null);
    }
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4 pt-2">
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

      {/* Step 1: Save & Activate 06B Master Key */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
        <div className="text-xs font-semibold text-slate-800">
          Langkah 1 — Simpan &amp; Aktifkan Kunci 06B Batch
        </div>
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
          </div>
        </div>

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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveKey}
            disabled={busy || !canSaveKey}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-xs font-medium text-white inline-flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {savingKey ? "Menyimpan Kunci..." : "Simpan & Aktifkan Kunci 06B"}
          </button>
          {file && (
            <span className="text-[11px] text-amber-800">
              Berkas <strong>{file.name}</strong> belum disimpan — klik &ldquo;Simpan &amp; Aktifkan Kunci 06B&rdquo; sebelum menjalankan koreksi.
            </span>
          )}
        </div>

        {keyStatus && (
          <div
            role="status"
            aria-live="polite"
            className={`p-3 rounded-xl text-xs border whitespace-pre-wrap break-words ${
              keyStatus.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {keyStatus.text}
          </div>
        )}
      </div>

      {/* Step 2: Run AI Written Grading */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-800">
              Langkah 2 — Jalankan Koreksi Tertulis AI (FR.IA.06C)
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Menggunakan kunci 06B aktif di batch untuk menilai jawaban asesi secara asinkron.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunGrading}
            disabled={busy || !isBatchKeyReady}
            className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-200 text-xs font-medium text-white inline-flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            {runningGrading ? "Menjalankan Koreksi AI..." : "Jalankan Koreksi Tertulis AI"}
          </button>
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

        {runningGrading && activeJob && (
          <div
            role="status"
            aria-live="polite"
            className="p-3 rounded-xl text-xs border bg-sky-50 border-sky-200 text-sky-900 flex flex-wrap items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>
                Koreksi tertulis sedang berjalan — Job ID:{" "}
                <code
                  data-testid="written-active-job-id"
                  className="font-mono font-semibold break-all"
                >
                  {activeJob.id}
                </code>
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white border border-sky-200 font-mono text-[11px]">
              {activeJob.status} · {activeJob.progress}%
            </span>
          </div>
        )}

        {gradingStatus && (
          <div
            role="status"
            aria-live="polite"
            className={`p-3 rounded-xl text-xs border whitespace-pre-wrap break-words ${
              gradingStatus.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {gradingStatus.text}
          </div>
        )}
      </div>
    </form>
  );
}
