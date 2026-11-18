"use client";

import React, { useRef, useState } from "react";
import { Upload, PenTool, Trash2, CheckCircle2, History } from "lucide-react";

interface SignatureItem {
  id: string;
  isActive: boolean;
  createdAt: string;
  sha256: string;
  signedUrl?: string;
}

interface SignatureUploadProps {
  versions: SignatureItem[];
  onUploadAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}

export function SignatureUpload({ versions, onUploadAction }: SignatureUploadProps) {
  const [mode, setMode] = useState<"upload" | "draw">("upload");
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeSignature = versions.find((v) => v.isActive);

  const handleFileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const fd = new FormData(e.currentTarget);
    const res = await onUploadAction(fd);
    setFeedback({
      ok: res.ok,
      text: res.ok
        ? "Tanda tangan berhasil diunggah dan diaktifkan."
        : res.error || "Gagal mengunggah tanda tangan.",
    });
    setIsSubmitting(false);
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    setIsDrawing(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSubmitting(true);
    setFeedback(null);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setFeedback({ ok: false, text: "Kanvas kosong." });
        setIsSubmitting(false);
        return;
      }
      const fd = new FormData();
      fd.append("file", new File([blob], "signature.png", { type: "image/png" }));
      const res = await onUploadAction(fd);
      setFeedback({
        ok: res.ok,
        text: res.ok
          ? "Tanda tangan dari kanvas berhasil disimpan."
          : res.error || "Gagal menyimpan tanda tangan.",
      });
      setIsSubmitting(false);
    }, "image/png");
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Tanda Tangan Digital Asesor (D11)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Disimpan privat per versi dan hanya dibubuhkan saat tanda tangan final FR.AK.05 / dokumen asesmen.
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              mode === "upload" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> Unggah PNG/JPG
          </button>
          <button
            type="button"
            onClick={() => setMode("draw")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              mode === "draw" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            <PenTool className="w-3.5 h-3.5" /> Gambar di Kanvas
          </button>
        </div>
      </div>

      {/* Active Signature Preview */}
      {activeSignature ? (
        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-950">
                Tanda Tangan Aktif
              </div>
              <div className="text-xs text-emerald-800 font-mono">
                Diunggah: {new Date(activeSignature.createdAt).toLocaleString("id-ID")}
              </div>
            </div>
          </div>
          {activeSignature.signedUrl && (
            <div className="bg-white p-2 rounded-lg border border-emerald-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeSignature.signedUrl}
                alt="Tanda tangan aktif asesor"
                className="h-12 w-auto object-contain"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          Tanda tangan belum diunggah. Finalisasi FR.AK.05 terkunci sampai tanda tangan aktif tersedia.
        </div>
      )}

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-medium border ${
            feedback.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {mode === "upload" ? (
        <form onSubmit={handleFileSubmit} className="space-y-4">
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg"
            required
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium cursor-pointer"
          >
            {isSubmitting ? "Mengunggah..." : "Unggah & Aktifkan Tanda Tangan"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <canvas
            ref={canvasRef}
            width={420}
            height={160}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
            className="border-2 border-dashed border-slate-300 rounded-xl bg-white touch-none cursor-crosshair w-full max-w-[420px]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={saveCanvas}
              className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium cursor-pointer"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Tanda Tangan"}
            </button>
            <button
              type="button"
              onClick={clearCanvas}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Bersihkan
            </button>
          </div>
        </div>
      )}

      {versions.length > 0 && (
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
            <History className="w-3.5 h-3.5" /> Riwayat Versi Tanda Tangan (Read-only)
          </div>
          <ul className="space-y-1.5 text-xs text-slate-500">
            {versions.map((v) => (
              <li key={v.id} className="flex justify-between font-mono">
                <span>
                  {v.id.slice(0, 8)} {v.isActive ? "(Aktif)" : "(Arsip)"}
                </span>
                <span>{new Date(v.createdAt).toLocaleString("id-ID")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
