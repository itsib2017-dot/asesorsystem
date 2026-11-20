"use client";
// Client interactivity required to trigger POST /api/v1/dit/[assesseeId]/analyse, prevent double-submit, and surface job feedback.

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileWarning, Play } from "lucide-react";
import { waitForJob } from "@/lib/jobs/wait-for-job";

interface InputStatusItem {
  label: string;
  fileName: string | null;
  fileNames?: string[];
  sourceNote?: string | null;
  hasExtractedText: boolean;
}

interface DitAnalysisTriggerProps {
  assesseeId: string;
  inputs: {
    fr04a: InputStatusItem;
    fr04b: InputStatusItem;
    cv: InputStatusItem;
  };
  hasExistingAnalysis: boolean;
}

export function DitAnalysisTrigger({
  assesseeId,
  inputs,
  hasExistingAnalysis,
}: DitAnalysisTriggerProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [manual04a, setManual04a] = useState("");
  const [manual04b, setManual04b] = useState("");
  const [manualCv, setManualCv] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const renderBadge = (item: InputStatusItem, hasOverride: boolean) => {
    const names = item.fileNames?.length
      ? item.fileNames
      : item.fileName
        ? [item.fileName]
        : [];
    const displayLabel =
      item.sourceNote ||
      (names.length > 1
        ? `${names.length} berkas (${names.slice(0, 2).join(", ")}${names.length > 2 ? ", ..." : ""})`
        : names[0] ?? null);

    if (item.hasExtractedText || hasOverride) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 max-w-full truncate"
          title={names.join(", ") || item.sourceNote || undefined}
        >
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span className="truncate">{displayLabel ? `Siap (${displayLabel})` : "Siap"}</span>
        </span>
      );
    }
    if (displayLabel) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-50 text-teal-800 border border-teal-200 max-w-full truncate"
          title={names.join(", ") || undefined}
        >
          <Clock className="w-3 h-3 shrink-0" />
          <span className="truncate">Drive ({displayLabel})</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
        <FileWarning className="w-3 h-3 shrink-0" /> Belum tersedia
      </span>
    );
  };

  const handleRunAnalysis = async () => {
    if (running) return;
    setRunning(true);
    setFeedback(null);

    try {
      const payload: Record<string, string> = {};
      if (manual04a.trim()) payload.frIa04aText = manual04a.trim();
      if (manual04b.trim()) payload.presentationTranscript = manual04b.trim();
      if (manualCv.trim()) payload.candidateProfileSummary = manualCv.trim();

      const res = await fetch(`/api/v1/dit/${assesseeId}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        data?: { job_id?: string; status?: string; error?: string };
        error?: { message?: string; details?: Array<{ issue?: string }> };
      };

      if (!res.ok || !json.ok) {
        const detailMsg = json.error?.details
          ?.map((d) => d.issue)
          .filter(Boolean)
          .join("; ");
        setFeedback({
          type: "error",
          text: [json.error?.message || "Gagal menjalankan analisis DIT.", detailMsg]
            .filter(Boolean)
            .join(" "),
        });
        return;
      }

      if (json.data?.status === "failed") {
        setFeedback({
          type: "error",
          text: `Job ${json.data.job_id ?? ""} gagal: ${json.data.error || "Terjadi kesalahan worker."}`,
        });
        return;
      }

      const jobId = json.data?.job_id;
      if (jobId) {
        const final = await waitForJob(jobId);
        if (final.status !== "done") {
          setFeedback({
            type: "error",
            text:
              final.status === "failed"
                ? `Analisis DIT gagal (Job ${jobId.slice(0, 8)}): ${final.error?.slice(0, 400) ?? "kesalahan worker."} Periksa kuota/mode BYOK Anda di Penyedia AI lalu jalankan ulang.`
                : `Analisis DIT masih berjalan (Job ${jobId.slice(0, 8)}). Periksa Status Pindai/Job pada halaman batch.`,
          });
          router.refresh();
          return;
        }
      }

      setFeedback({
        type: "success",
        text: `Analisis DIT selesai (Job ${jobId?.slice(0, 8) ?? "-"}).`,
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat memanggil analisis DIT.",
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
            Eksekusi Analisis DIT (FR.IA.04A vs Presentasi &amp; CV)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sistem mengekstrak berkas Drive secara otomatis bila teks belum tersimpan sebelum memanggil AI (hanya pseudonim).
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={running}
          className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          {running
            ? "Mengekstrak & Menganalisis DIT..."
            : hasExistingAnalysis
              ? "Jalankan Ulang Analisis DIT"
              : "Jalankan Analisis DIT"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-medium text-slate-700">{inputs.fr04a.label}</span>
          {renderBadge(inputs.fr04a, Boolean(manual04a.trim()))}
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-medium text-slate-700">{inputs.fr04b.label}</span>
          {renderBadge(inputs.fr04b, Boolean(manual04b.trim()))}
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-medium text-slate-700">{inputs.cv.label}</span>
          {renderBadge(inputs.cv, Boolean(manualCv.trim()))}
        </div>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
        <summary className="cursor-pointer font-medium text-slate-700">
          Lengkapi / Tempel Teks Bahan Manual (opsional — berguna jika berkas CV berupa pindaian gambar)
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div>
            <label htmlFor="manual04a" className="block font-semibold text-slate-700 mb-1">
              Teks FR.IA.04A
            </label>
            <textarea
              id="manual04a"
              rows={3}
              value={manual04a}
              onChange={(e) => setManual04a(e.target.value)}
              placeholder="Opsional jika sudah ada berkas 04A di Drive..."
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-mono"
            />
          </div>
          <div>
            <label htmlFor="manual04b" className="block font-semibold text-slate-700 mb-1">
              Teks Presentasi (04B)
            </label>
            <textarea
              id="manual04b"
              rows={3}
              value={manual04b}
              onChange={(e) => setManual04b(e.target.value)}
              placeholder="Opsional jika sudah ada .pptx di Drive..."
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-mono"
            />
          </div>
          <div>
            <label htmlFor="manualCv" className="block font-semibold text-slate-700 mb-1">
              Ringkasan Profil / CV
            </label>
            <textarea
              id="manualCv"
              rows={3}
              value={manualCv}
              onChange={(e) => setManualCv(e.target.value)}
              placeholder="Tempel ringkasan CV jika file PDF berupa scan..."
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-mono"
            />
          </div>
        </div>
      </details>

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
