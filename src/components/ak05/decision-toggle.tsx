"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface DecisionToggleProps {
  assesseeId: string;
  batchId: string;
  unitCode: string;
  unitTitle: string;
  aiRecommendation?: "K" | "BK" | null;
  vatmReasoning?: string | null;
  initialDecision?: "K" | "BK" | null;
  initialNote?: string | null;
  onSaveDecision: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}

export function DecisionToggle({
  assesseeId,
  batchId,
  unitCode,
  unitTitle,
  aiRecommendation,
  vatmReasoning,
  initialDecision,
  initialNote,
  onSaveDecision,
}: DecisionToggleProps) {
  const [decision, setDecision] = useState<"K" | "BK" | null>(initialDecision ?? null);
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSave = async (val: "K" | "BK") => {
    if (val === "BK" && !note.trim()) {
      setMsg("Catatan alasan wajib diisi apabila memilih BK (Belum Kompeten).");
      setDecision("BK");
      return;
    }

    setSaving(true);
    setMsg(null);
    setDecision(val);

    const fd = new FormData();
    fd.append("assesseeId", assesseeId);
    fd.append("batchId", batchId);
    fd.append("unitCode", unitCode);
    fd.append("unitTitle", unitTitle);
    fd.append("decision", val);
    fd.append("assessorNote", note);
    if (aiRecommendation) fd.append("aiRecommendation", aiRecommendation);
    if (vatmReasoning) fd.append("vatmReasoning", vatmReasoning);

    const res = await onSaveDecision(fd);
    setMsg(res.ok ? `Keputusan ${val} tersimpan.` : res.error || "Gagal menyimpan.");
    setSaving(false);
  };

  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono text-slate-500">{unitCode}</div>
          <div className="text-sm font-semibold text-slate-900">{unitTitle}</div>
          {aiRecommendation ? (
            <div className="mt-1 text-xs text-slate-600">
              <span className="underline decoration-dotted font-semibold text-teal-700">
                Rekomendasi AI (VATM): {aiRecommendation}
              </span>{" "}
              {vatmReasoning ? `— ${vatmReasoning}` : ""}
            </div>
          ) : (
            vatmReasoning && (
              <div className="mt-1 text-xs text-slate-500">
                <span className="font-medium text-slate-600">
                  Rekomendasi AI (VATM): Netral / Belum Dinilai
                </span>{" "}
                — {vatmReasoning}
              </div>
            )
          )}
        </div>

        {/* Binary K / BK Only (D15) */}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("K")}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer transition-all ${
              decision === "K"
                ? "bg-emerald-700 border-emerald-700 text-white"
                : "bg-white border-slate-300 text-slate-700 hover:border-emerald-500"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> K — Kompeten
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("BK")}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer transition-all ${
              decision === "BK"
                ? "bg-rose-700 border-rose-700 text-white"
                : "bg-white border-slate-300 text-slate-700 hover:border-rose-500"
            }`}
          >
            <XCircle className="w-4 h-4" /> BK — Belum Kompeten
          </button>
        </div>
      </div>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan asesor (wajib diisi jika BK)..."
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
      />
      {msg && <p className="text-xs font-medium text-teal-700">{msg}</p>}
    </div>
  );
}
