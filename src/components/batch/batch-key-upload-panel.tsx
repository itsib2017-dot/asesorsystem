"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, KeyRound, Lock, ShieldOff, Upload } from "lucide-react";
import {
  activateBatchMasterKey06bAction,
  deactivateBatchMasterKey06bAction,
  uploadBatchMasterKey06bAction,
} from "@/app/(app)/batches/[id]/actions";

export interface BatchKeyCandidateSummary {
  id: string;
  fileName: string;
  drivePath: string;
  originLabel: string;
  isActive: boolean;
  isEncryptedOrUnextracted: boolean;
  canActivate: boolean;
  statusLabel: string;
  reasonSummary: string;
}

interface BatchKeyUploadPanelProps {
  batchId: string;
  activeKeyFileName: string | null;
  activeKeySourceLabel: string | null;
  activeKeyDrivePath: string | null;
  activeKeyValidationSummary: string | null;
  activeKeyActivatedAt: string | null;
  isReadyForGrading: boolean;
  blockingWarning: string | null;
  candidates: BatchKeyCandidateSummary[];
}

export function BatchKeyUploadPanel({
  batchId,
  activeKeyFileName,
  activeKeySourceLabel,
  activeKeyDrivePath,
  activeKeyValidationSummary,
  activeKeyActivatedAt,
  isReadyForGrading,
  blockingWarning,
  candidates,
}: BatchKeyUploadPanelProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
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
      if (password.length > 0) {
        fd.append("masterKeyPassword", password);
      }
      const res = await uploadBatchMasterKey06bAction(fd);
      if (!res.ok) {
        setStatus({
          type: "error",
          text: res.error || "Gagal mengunggah kunci jawaban 06B.",
        });
      } else {
        setStatus({
          type: "success",
          text: `Kunci 06B "${res.fileName}" lolos validasi isi dan aktif untuk seluruh asesi batch ini.`,
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
      setUploading(false);
    }
  };

  const handleActivateCandidate = async (fileId: string) => {
    setPendingActionId(fileId);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("batchId", batchId);
      fd.append("fileId", fileId);
      const res = await activateBatchMasterKey06bAction(fd);
      if (!res.ok) {
        setStatus({
          type: "error",
          text: res.error || "Gagal mengaktifkan kandidat kunci 06B.",
        });
      } else {
        setStatus({
          type: "success",
          text: `Kunci 06B "${res.fileName}" berhasil ditandai aktif untuk batch ini.`,
        });
        router.refresh();
      }
    } catch (err) {
      setStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan jaringan.",
      });
    } finally {
      setPendingActionId(null);
    }
  };

  const handleDeactivate = async () => {
    setPendingActionId("deactivate");
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("batchId", batchId);
      const res = await deactivateBatchMasterKey06bAction(fd);
      if (!res.ok) {
        setStatus({
          type: "error",
          text: res.error || "Gagal menonaktifkan kunci 06B.",
        });
      } else {
        setStatus({
          type: "success",
          text: "Kunci 06B aktif dinonaktifkan (berkas tetap tersimpan tanpa dihapus).",
        });
        router.refresh();
      }
    } catch (err) {
      setStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan jaringan.",
      });
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">
              Kunci Jawaban Tertulis (FR.IA.06B)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Unggah atau tandai berkas kunci kerja FR.IA.06B (.docx / .txt) yang berisi teks jawaban untuk dipakai pada seluruh penilaian tertulis asesi.
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium border break-words max-w-full ${
            isReadyForGrading && activeKeyFileName
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          {isReadyForGrading && activeKeyFileName
            ? `Aktif & Terverifikasi: ${activeKeyFileName}`
            : "Belum ada kunci 06B aktif"}
        </span>
      </div>

      {isReadyForGrading && activeKeyFileName ? (
        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Kunci Jawaban Kerja Siap Digunakan</span>
            </div>
            <div>
              Asal: <strong>{activeKeySourceLabel ?? "-"}</strong>
              {activeKeyDrivePath && (
                <>
                  {" · "}
                  <span className="font-mono text-[11px] break-all">{activeKeyDrivePath}</span>
                </>
              )}
            </div>
            {activeKeyValidationSummary && (
              <div className="text-emerald-800">{activeKeyValidationSummary}</div>
            )}
            {activeKeyActivatedAt && (
              <div className="font-mono text-[11px] text-emerald-800">
                Diaktifkan pada: {activeKeyActivatedAt}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={pendingActionId !== null}
            className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-800 text-xs font-medium text-emerald-900 inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <ShieldOff className="w-3.5 h-3.5" />
            {pendingActionId === "deactivate" ? "Menonaktifkan..." : "Nonaktifkan Kunci"}
          </button>
        </div>
      ) : (
        blockingWarning && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-900">
                Koreksi Tertulis Diblokir Hingga Kunci Kerja Aktif
              </p>
              <p className="leading-relaxed">{blockingWarning}</p>
            </div>
          </div>
        )
      )}

      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:border-teal-600 text-xs text-slate-700 cursor-pointer max-w-full">
          <Upload className="w-3.5 h-3.5 text-teal-700 shrink-0" />
          <span className="truncate max-w-[240px] sm:max-w-xs">
            {file ? file.name : "Pilih file FR.IA.06B (.docx / .txt)..."}
          </span>
          <input
            type="file"
            accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 focus-within:border-teal-600">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            aria-label="Kata sandi berkas 06B (opsional, hanya untuk dekripsi di memori)"
            placeholder="Kata sandi file (jika terenkripsi)..."
            className="text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none w-48 sm:w-52 bg-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
        >
          {uploading ? "Memvalidasi & Mengunggah..." : "Simpan & Aktifkan Kunci 06B"}
        </button>
      </form>
      <p className="text-[11px] text-slate-500">
        Setiap berkas 06B divalidasi isinya di server sebelum diaktifkan (blanko kosong, lembar soal 06A, atau berkas terenkripsi tanpa sandi ditolak otomatis). Kata sandi hanya dipakai di memori server untuk membuka berkas dan tidak pernah disimpan.
      </p>

      {candidates.length > 0 && (
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Berkas 06B Terdeteksi di Batch ({candidates.length})
          </h3>
          <div className="space-y-2">
            {candidates.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-900 break-words">
                      {c.fileName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        c.isActive && c.canActivate
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : c.canActivate
                            ? "bg-teal-50 text-teal-800 border-teal-200"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                    >
                      {c.statusLabel}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-white border border-slate-200 text-slate-600">
                      {c.originLabel}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 break-all">
                    {c.drivePath}
                  </div>
                  <div className="text-slate-600">{c.reasonSummary}</div>
                </div>

                <div className="shrink-0">
                  {c.isActive ? (
                    <button
                      type="button"
                      onClick={handleDeactivate}
                      disabled={pendingActionId !== null}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-rose-50 hover:border-rose-300 text-xs font-medium text-slate-700 cursor-pointer disabled:opacity-50"
                    >
                      Nonaktifkan
                    </button>
                  ) : c.canActivate ? (
                    <button
                      type="button"
                      onClick={() => handleActivateCandidate(c.id)}
                      disabled={pendingActionId !== null}
                      className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium cursor-pointer disabled:opacity-50"
                    >
                      {pendingActionId === c.id ? "Mengaktifkan..." : "Tandai Sebagai Kunci Aktif"}
                    </button>
                  ) : (
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px]">
                      Tidak dapat diaktifkan (blanko / tidak terbaca)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
