"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play } from "lucide-react";
import { readApiResponse } from "@/lib/http/read-api-response";

export function SimilarityRunTrigger({ batchId }: { batchId: string }) {
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
    try {
      const res = await fetch("/api/v1/jobs/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "similarity_run",
          payload: { batchId },
        }),
      });
      const parsed = await readApiResponse<{ job_id?: string; status?: string }>(
        res,
        "Gagal menjalankan analisis kemiripan.",
      );
      if (!parsed.ok) {
        setFeedback({
          type: "error",
          text: parsed.message,
        });
        return;
      }
      setFeedback({
        type: "success",
        text: `Analisis kemiripan dijalankan (Job ${parsed.data?.job_id?.slice(0, 8) ?? "-"} · ${parsed.data?.status ?? "done"}). Segarkan halaman untuk melihat hasil pasangan dan skor.`,
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat memanggil analisis kemiripan.",
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
            Jalankan Analisis Kemiripan Batch
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bandingkan jawaban tertulis antar asesi dalam satu batch dan flag pasangan dengan
            kemiripan tinggi untuk peninjauan manual.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          {running ? "Menjalankan..." : "Jalankan Analisis Kemiripan"}
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
