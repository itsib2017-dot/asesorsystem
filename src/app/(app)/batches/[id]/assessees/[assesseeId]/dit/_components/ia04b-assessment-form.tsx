"use client";
// Client interactivity required for toggling Ya/Tidak/Belum ratings per aspect on the standalone FR.IA.04B form and submitting changes.

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Save, XCircle } from "lucide-react";
import type { Official04bAssessment, Official04bItemRating } from "@/lib/forms/assessee-forms";
import type { SchemeKelompokSpec } from "@/repositories/schemes.repository";
import { saveIa04bAssessmentAction } from "../actions";

interface Ia04bAssessmentFormProps {
  batchId: string;
  assesseeId: string;
  kelompokPekerjaan: SchemeKelompokSpec[];
  initialAssessment: Official04bAssessment;
}

function buildInitialItems(
  kelompokPekerjaan: SchemeKelompokSpec[],
  savedItems: Official04bItemRating[],
): Official04bItemRating[] {
  return kelompokPekerjaan.flatMap((kp) =>
    kp.aspects.map((asp) => {
      const existing =
        savedItems.find((s) => s.kpIndex === kp.kpIndex && s.no === asp.no) ??
        (asp.unitCode
          ? savedItems.find((s) => s.unitCode.toLowerCase() === asp.unitCode.toLowerCase())
          : undefined);
      return {
        kpIndex: kp.kpIndex,
        no: asp.no,
        unitCode: asp.unitCode,
        achieved: existing ? existing.achieved : null,
        note: existing?.note ?? "",
      };
    }),
  );
}

export function Ia04bAssessmentForm({
  batchId,
  assesseeId,
  kelompokPekerjaan,
  initialAssessment,
}: Ia04bAssessmentFormProps) {
  const router = useRouter();
  const [items, setItems] = useState<Official04bItemRating[]>(() =>
    buildInitialItems(kelompokPekerjaan, initialAssessment.items),
  );
  const [overall, setOverall] = useState<"K" | "BK" | null>(
    initialAssessment.overallRecommendation,
  );
  const [assessorNotes, setAssessorNotes] = useState(initialAssessment.assessorNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const setAspectAchieved = (kpIndex: number, no: number, achieved: boolean | null) => {
    const next = items.map((item) =>
      item.kpIndex === kpIndex && item.no === no ? { ...item, achieved } : item,
    );
    setItems(next);
    if (next.some((item) => item.achieved === false)) {
      setOverall("BK");
    }
  };

  const setAspectNote = (kpIndex: number, no: number, note: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.kpIndex === kpIndex && item.no === no ? { ...item, note } : item,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || items.length === 0) return;

    setSaving(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("batchId", batchId);
      fd.append("assesseeId", assesseeId);
      fd.append("itemsJson", JSON.stringify(items));
      if (overall) fd.append("overallRecommendation", overall);
      fd.append("assessorNotes", assessorNotes);

      const res = await saveIa04bAssessmentAction(fd);
      if (!res.ok) {
        setStatus({ type: "error", text: res.error ?? "Gagal menyimpan formulir FR.IA.04B." });
        return;
      }
      setStatus({ type: "success", text: res.message ?? "Penilaian FR.IA.04B tersimpan." });
      router.refresh();
    } catch (err) {
      setStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan jaringan.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (kelompokPekerjaan.length === 0) {
    return null;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ClipboardCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Pengisian Penilaian FR.IA.04B oleh Asesor (Formulir Mandiri)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Tanda <strong>Ya / Tidak</strong> pada blanko resmi ditetapkan langsung oleh asesor
              (bukan tercentang otomatis dari AI). Simpan untuk memperbarui pratinjau &amp; ekspor DOCX.
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
          Ya: {items.filter((i) => i.achieved === true).length} · Tidak:{" "}
          {items.filter((i) => i.achieved === false).length} · Belum:{" "}
          {items.filter((i) => i.achieved === null).length}
        </div>
      </div>

      <div className="space-y-4">
        {kelompokPekerjaan.map((kp) => (
          <div key={kp.kpIndex} className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              {kp.title}
            </div>
            <div className="space-y-2.5">
              {kp.aspects.map((asp) => {
                const current = items.find(
                  (i) => i.kpIndex === kp.kpIndex && i.no === asp.no,
                );
                const val = current?.achieved ?? null;
                return (
                  <div
                    key={`${kp.kpIndex}-${asp.no}`}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-xs font-semibold text-slate-900">
                          {asp.no}. {asp.lingkup}{" "}
                          <span className="font-mono text-[11px] font-normal text-slate-500">
                            ({asp.unitCode})
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">{asp.question}</p>
                        <p className="text-[11px] text-slate-500">{asp.kukRef}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-xs">
                        <button
                          type="button"
                          onClick={() => setAspectAchieved(kp.kpIndex, asp.no, true)}
                          className={`px-3 py-1 rounded-lg border font-medium cursor-pointer ${
                            val === true
                              ? "bg-emerald-700 border-emerald-700 text-white"
                              : "bg-white border-slate-300 text-slate-700"
                          }`}
                        >
                          Ya
                        </button>
                        <button
                          type="button"
                          onClick={() => setAspectAchieved(kp.kpIndex, asp.no, false)}
                          className={`px-3 py-1 rounded-lg border font-medium cursor-pointer ${
                            val === false
                              ? "bg-rose-700 border-rose-700 text-white"
                              : "bg-white border-slate-300 text-slate-700"
                          }`}
                        >
                          Tidak
                        </button>
                        <button
                          type="button"
                          onClick={() => setAspectAchieved(kp.kpIndex, asp.no, null)}
                          className={`px-2.5 py-1 rounded-lg border font-medium cursor-pointer ${
                            val === null
                              ? "bg-slate-700 border-slate-700 text-white"
                              : "bg-white border-slate-300 text-slate-600"
                          }`}
                        >
                          Belum
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={current?.note ?? ""}
                      onChange={(e) => setAspectNote(kp.kpIndex, asp.no, e.target.value)}
                      placeholder="Catatan bukti / umpan balik asesor untuk aspek ini (opsional)..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-800">
            Rekomendasi Keseluruhan FR.IA.04B (Biner K / BK)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOverall("K")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                overall === "K"
                  ? "bg-emerald-700 border-emerald-700 text-white"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> K — Kompeten
            </button>
            <button
              type="button"
              onClick={() => setOverall("BK")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                overall === "BK"
                  ? "bg-rose-700 border-rose-700 text-white"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" /> BK — Belum Kompeten
            </button>
            <button
              type="button"
              onClick={() => setOverall(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer ${
                overall === null
                  ? "bg-slate-700 border-slate-700 text-white"
                  : "bg-white border-slate-300 text-slate-600"
              }`}
            >
              Belum ditetapkan
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="ia04bNotes" className="block text-xs font-semibold text-slate-700 mb-1">
            Catatan Asesor FR.IA.04B (wajib diisi jika BK)
          </label>
          <textarea
            id="ia04bNotes"
            rows={2}
            value={assessorNotes}
            onChange={(e) => setAssessorNotes(e.target.value)}
            placeholder="Catat ringkasan bukti presentasi atau alasan tindak lanjut BK..."
            className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800"
          />
        </div>

        {status && (
          <div
            role="status"
            aria-live="polite"
            className={`p-3 rounded-xl text-xs border ${
              status.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {status.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Menyimpan Penilaian FR.IA.04B..." : "Simpan Penilaian FR.IA.04B"}
        </button>
      </div>
    </form>
  );
}
