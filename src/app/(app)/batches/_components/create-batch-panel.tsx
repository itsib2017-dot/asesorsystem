"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen } from "lucide-react";
import { readApiResponse } from "@/lib/http/read-api-response";

interface CreateBatchPanelProps {
  schemes: Array<{ id: string; code: string; name: string }>;
}

export function CreateBatchPanel({ schemes }: CreateBatchPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [schemeId, setSchemeId] = useState(schemes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [tukName, setTukName] = useState("");
  const [tukType, setTukType] = useState<"sewaktu" | "tempat_kerja" | "mandiri">("sewaktu");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [kelompokSheetUrl, setKelompokSheetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemeId,
          name,
          tukName,
          tukType,
          assessmentDate: assessmentDate || undefined,
          driveFolderUrl,
          kelompokSheetUrl: kelompokSheetUrl || undefined,
        }),
      });
      const parsed = await readApiResponse<{ batchId: string }>(res, "Gagal membuat batch.");
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      setOpen(false);
      router.push(`/batches/${parsed.data?.batchId}`);
      router.refresh();
    } catch {
      setError("Koneksi gagal saat membuat batch.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-sm font-medium text-white shadow-sm inline-flex items-center gap-2 cursor-pointer"
      >
        <Plus className="w-4 h-4" /> Buat Batch Baru
      </button>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4 w-full mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-teal-700" />
          <h2 className="font-semibold text-slate-900">
            Buat Batch Baru (Intake Singkat 3 Langkah — D13)
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          Tutup
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              1. Pilih Skema Terdaftar
            </label>
            <select
              value={schemeId}
              onChange={(e) => setSchemeId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            >
              {schemes.length === 0 && (
                <option value="">Belum ada skema terdaftar</option>
              )}
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Batch
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Contoh: Batch 12 Nov 2026 - Grup 11 & 12"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama TUK
            </label>
            <input
              value={tukName}
              onChange={(e) => setTukName(e.target.value)}
              placeholder="Contoh: TUK PT. Global Competency Investama"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Jenis TUK
            </label>
            <select
              value={tukType}
              onChange={(e) =>
                setTukType(e.target.value as "sewaktu" | "tempat_kerja" | "mandiri")
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="sewaktu">Sewaktu</option>
              <option value="tempat_kerja">Tempat Kerja</option>
              <option value="mandiri">Mandiri</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Tanggal Asesmen (Opsional)
          </label>
          <input
            type="date"
            value={assessmentDate}
            onChange={(e) => setAssessmentDate(e.target.value)}
            className="w-full sm:max-w-xs px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Dapat diisi langsung di sini, disunting nanti, atau terisi otomatis dari Surat Tugas.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            2. Tautan Folder Google Drive Publik (Persyaratan / Tugas DIT)
          </label>
          <input
            type="url"
            value={driveFolderUrl}
            onChange={(e) => setDriveFolderUrl(e.target.value)}
            required
            placeholder="https://drive.google.com/drive/folders/..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-mono"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Pemindaian antrean inline optimal untuk sekitar &le; 50 berkas per proses. Jika folder berisi &gt; 50 berkas, pecah per kelompok atau jalankan pindai ulang bertahap.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            3. Tautan Google Sheet Kelompok Asesi (Opsional)
          </label>
          <input
            type="url"
            value={kelompokSheetUrl}
            onChange={(e) => setKelompokSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !schemeId}
          className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
        >
          {submitting ? "Membuat Batch..." : "Buat Batch & Mulai Pindai"}
        </button>
      </form>
    </div>
  );
}
