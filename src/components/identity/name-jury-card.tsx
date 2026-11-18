"use client";

import React, { useState } from "react";
import { ShieldCheck, AlertTriangle, Check, Edit3, HelpCircle } from "lucide-react";

interface NameJuryCardProps {
  assesseeId: string;
  ktpOcrName: string;
  apl01Name: string;
  suratTugasName: string;
  ijazahName: string;
  ocrConfidence: number;
  verdict: "match" | "mismatch_resolved" | "needs_human";
  proposedName: string | null;
  reasoning: string;
  confirmedName: string | null;
  onConfirmAction: (formData: FormData) => Promise<{ ok: boolean; message?: string }>;
}

export function NameJuryCard({
  assesseeId,
  ktpOcrName,
  apl01Name,
  suratTugasName,
  ijazahName,
  ocrConfidence,
  verdict,
  proposedName,
  reasoning,
  confirmedName,
  onConfirmAction,
}: NameJuryCardProps) {
  const [customMode, setCustomMode] = useState(false);
  const [typedName, setTypedName] = useState(proposedName || ktpOcrName || "");
  const [overrideReason, setOverrideReason] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (nameToSave: string, reason?: string) => {
    setPending(true);
    setStatusMsg(null);
    const fd = new FormData();
    fd.append("assesseeId", assesseeId);
    fd.append("confirmedName", nameToSave);
    if (reason) fd.append("overrideReason", reason);

    const res = await onConfirmAction(fd);
    setStatusMsg(res.message ?? (res.ok ? "Nama sertifikat dikonfirmasi." : "Gagal menyimpan."));
    setPending(false);
    setCustomMode(false);
  };

  const verdictBadge =
    verdict === "match" ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Check className="w-3.5 h-3.5" /> Cocok
      </span>
    ) : verdict === "mismatch_resolved" ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        <AlertTriangle className="w-3.5 h-3.5" /> Beda — Diusulkan (Rekomendasi AI)
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
        <HelpCircle className="w-3.5 h-3.5" /> Perlu Keputusan Manusia
      </span>
    );

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Verifikasi Nama Sertifikat (Juri Nama & Otoritas KTP)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aturan D6: Ejaan pada KTP merupakan otoritas tertinggi nama tercetak di sertifikat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            OCR Yakin: {Math.round(ocrConfidence * 100)}%
          </span>
          {verdictBadge}
        </div>
      </div>

      {/* 4 Name Sources Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-teal-50/70 border-2 border-teal-600/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
              KTP (Otoritas)
            </span>
            <ShieldCheck className="w-4 h-4 text-teal-700" />
          </div>
          <div className="font-semibold text-sm text-slate-900">
            {ktpOcrName || "Belum terbaca"}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            FR.APL.01
          </div>
          <div className="font-medium text-sm text-slate-800">
            {apl01Name || "-"}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Surat Tugas
          </div>
          <div className="font-medium text-sm text-slate-800">
            {suratTugasName || "-"}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Ijazah
          </div>
          <div className="font-medium text-sm text-slate-800">
            {ijazahName || "-"}
          </div>
        </div>
      </div>

      {/* AI Jury Reasoning */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Analisis Juri AI (Rekomendasi): </span>
        {reasoning}
      </div>

      {confirmedName && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            Nama tercetak di sertifikat terkonfirmasi: <strong>{confirmedName}</strong>
          </span>
        </div>
      )}

      {statusMsg && (
        <p className="text-xs font-medium text-teal-700">{statusMsg}</p>
      )}

      {/* Assessor Decision Controls */}
      {!customMode ? (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {(proposedName || ktpOcrName) && verdict !== "needs_human" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => handleSubmit(proposedName || ktpOcrName)}
              className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Konfirmasi Nama: {proposedName || ktpOcrName}
            </button>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={() => setCustomMode(true)}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-medium transition-all flex items-center gap-2 cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            Ubah / Ketik Sendiri
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Tercetak di Sertifikat (Sesuai KTP)
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alasan Koreksi / Override (Wajib untuk Audit Log)
            </label>
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Contoh: Menyesuaikan ejaan KTP asli"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !typedName.trim()}
              onClick={() => handleSubmit(typedName.trim(), overrideReason)}
              className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium cursor-pointer"
            >
              Simpan Konfirmasi
            </button>
            <button
              type="button"
              onClick={() => setCustomMode(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
