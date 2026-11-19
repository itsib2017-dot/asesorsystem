"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play } from "lucide-react";

interface ExtractFileTriggerProps {
  batchId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  driveFileId: string;
  hasExtractedText: boolean;
}

export function ExtractFileTrigger({
  batchId,
  fileId,
  fileName,
  mimeType,
  driveFileId,
  hasExtractedText,
}: ExtractFileTriggerProps) {
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
    fd.append("batchId", batchId);
    fd.append("fileId", fileId);

    try {
      const res = await fetch("/api/v1/jobs/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "extract_file",
          payload: {
            fileId,
            fileName,
            mimeType,
            driveFileId,
          },
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { job_id?: string; status?: string };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error?.message || "Gagal menjalankan ekstraksi berkas.",
        });
        return;
      }
      setFeedback({
        type: "success",
        text: `Ekstraksi berkas dijalankan (Job ${json.data?.job_id?.slice(0, 8) ?? "-"} · ${json.data?.status ?? "done"}). Segarkan halaman untuk melihat hasilnya.`,
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat mengekstrak berkas.",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        title={
          hasExtractedText
            ? "Ekstrak ulang teks dari berkas ini"
            : "Ekstrak teks dari berkas ini"
        }
        aria-label={hasExtractedText ? "Ekstrak ulang teks" : "Ekstrak teks"}
        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
          running
            ? "opacity-50 cursor-not-allowed"
            : hasExtractedText
              ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200"
              : "bg-teal-700 hover:bg-teal-800 text-white"
        }`}
      >
        <Play className="w-3 h-3" />
        {running ? "Mengambil..." : hasExtractedText ? "Ekstrak Ulang" : "Ekstrak Teks"}
      </button>
      {feedback && (
        <span
          className={`text-[10px] font-medium ${
            feedback.type === "success"
              ? "text-emerald-700"
              : "text-rose-700"
          }`}
          title={feedback.text}
        >
          {feedback.type === "success" ? "✓" : "✗"} {feedback.text}
        </span>
      )}
    </div>
  );
}
