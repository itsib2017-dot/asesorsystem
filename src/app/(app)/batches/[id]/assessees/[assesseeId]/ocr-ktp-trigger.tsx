"use client";
// Client interactivity required for triggering local OCR KTP action, displaying feedback state, and refreshing server data.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { runOcrKtpAction } from "./actions";

interface OcrKtpTriggerProps {
  assesseeId: string;
  batchId: string;
}

export function OcrKtpTrigger({ assesseeId, batchId }: OcrKtpTriggerProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setFeedback(null);
    const fd = new FormData();
    fd.append("assesseeId", assesseeId);
    fd.append("batchId", batchId);

    try {
      const res = await runOcrKtpAction(fd);
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error ?? "OCR KTP gagal." });
        return;
      }
      setFeedback({
        type: "success",
        text: res.message ?? "OCR KTP selesai.",
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan saat menjalankan OCR KTP.",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4 border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            OCR KTP — Verifikasi Nama (Juri Nama)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Baca teks dari berkas KTP asesi secara lokal (Tesseract). Gambar KTP tidak pernah dikirim
            ke LLM. Hasil digunakan juri nama untuk menentukan nama tercetak di sertifikat.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          {running ? "Menjalankan OCR..." : "Jalankan OCR KTP"}
        </button>
      </div>
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-xl text-xs border ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
