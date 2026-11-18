"use client";

import React, { useState } from "react";
import { PlusCircle } from "lucide-react";
import { saveSchemeManifestAction } from "../actions";

export function SchemeRegistrationForm() {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const fd = new FormData(e.currentTarget);
    const res = await saveSchemeManifestAction(fd);
    setFeedback({
      ok: res.ok,
      text: res.ok
        ? "Manifes skema berhasil disimpan."
        : res.error || "Gagal menyimpan skema.",
    });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <PlusCircle className="w-5 h-5 text-teal-700" />
        <h2 className="text-lg font-semibold text-slate-900">
          Daftarkan Skema & Manifes Baru (D17)
        </h2>
      </div>
      <p className="text-xs text-slate-500">
        Setiap skema memiliki himpunan formulir, jumlah soal, aturan keputusan, dan prasyarat masing-masing (tidak ada angka bawaan skema lain yang dikunci di kode).
      </p>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            feedback.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Kode Skema
          </label>
          <input
            name="code"
            required
            placeholder="Contoh: AK3U / PK3"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nama Skema Sertifikasi
          </label>
          <input
            name="name"
            required
            placeholder="Contoh: Ahli K3 Umum"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Jumlah Soal Resmi FR.IA.04B
          </label>
          <input
            name="official04bCount"
            type="number"
            min="1"
            required
            placeholder="Isi sesuai dokumen skema"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Jumlah Soal Esai 06A
          </label>
          <input
            name="written06aCount"
            type="number"
            min="1"
            required
            placeholder="Isi sesuai MUK"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Jumlah Bank Soal Asesor
          </label>
          <input
            name="questionBankCount"
            type="number"
            min="1"
            required
            placeholder="Konfigurasi bank soal"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Pemetaan Sufiks Soal
          </label>
          <input
            name="soalSuffix"
            defaultValue="06A"
            required
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Pemetaan Sufiks Kunci
          </label>
          <input
            name="kunciSuffix"
            defaultValue="06B"
            required
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Pemetaan Sufiks Jawaban
          </label>
          <input
            name="jawabanSuffix"
            defaultValue="06C"
            required
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Aturan Keputusan
          </label>
          <input
            name="decisionRule"
            defaultValue="VATM"
            required
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Rujukan Dokumen Skema
          </label>
          <input
            name="decisionRuleRef"
            placeholder="Contoh: Dokumen Skema §9.3.3-9.3.4"
            required
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Prasyarat Pendaftaran (1 per baris)
          </label>
          <textarea
            name="prerequisites"
            rows={3}
            placeholder="Isi kombinasi pendidikan / pengalaman sesuai skema..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Persyaratan Dokumen (1 per baris)
          </label>
          <textarea
            name="registrationRequirements"
            rows={3}
            placeholder="KTP, Ijazah, CV..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium cursor-pointer"
      >
        {saving ? "Menyimpan Manifes..." : "Simpan Skema & Manifes"}
      </button>
    </form>
  );
}
