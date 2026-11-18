"use client";
// Client interactivity required for editing FR.IA.09 interview questions, Ya/Tidak ratings, per-unit K/BK impact, and form submission.

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Save, XCircle } from "lucide-react";
import { saveInterviewAssessmentAction } from "../actions";

export interface InterviewQuestionItem {
  no: number;
  question: string;
  answerSummary: string;
  achieved: "Ya" | "Tidak" | null;
  unitCode?: string;
}

export interface InterviewUnitItem {
  unitCode: string;
  unitTitle: string;
  recommendation: "K" | "BK";
  reasoning: string;
}

interface InterviewAssessmentFormProps {
  batchId: string;
  assesseeId: string;
  sourceFileId: string | null;
  initialQuestions: InterviewQuestionItem[];
  initialUnits: InterviewUnitItem[];
  initialOverall: "K" | "BK";
  initialNotes: string;
}

export function InterviewAssessmentForm({
  batchId,
  assesseeId,
  sourceFileId,
  initialQuestions,
  initialUnits,
  initialOverall,
  initialNotes,
}: InterviewAssessmentFormProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<InterviewQuestionItem[]>(initialQuestions);
  const [units, setUnits] = useState<InterviewUnitItem[]>(initialUnits);
  const [overall, setOverall] = useState<"K" | "BK">(initialOverall);
  const [notes, setNotes] = useState(initialNotes);
  const [applyToDecisions, setApplyToDecisions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updateQuestion = (idx: number, patch: Partial<InterviewQuestionItem>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  };

  const updateUnitRec = (idx: number, recommendation: "K" | "BK") => {
    setUnits((prev) => {
      const next = prev.map((u, i) =>
        i === idx
          ? {
              ...u,
              recommendation,
              reasoning:
                u.reasoning ||
                (recommendation === "BK"
                  ? "Bukti wawancara FR.IA.09 belum memenuhi kriteria VATM unit ini."
                  : "Wawancara FR.IA.09 memenuhi kriteria VATM."),
            }
          : u,
      );
      if (next.some((u) => u.recommendation === "BK")) {
        setOverall("BK");
      }
      return next;
    });
  };

  const handleOverallSelect = (val: "K" | "BK") => {
    setOverall(val);
    if (val === "K") {
      setUnits((prev) =>
        prev.map((u) => ({
          ...u,
          recommendation: "K",
          reasoning: u.reasoning || "Wawancara FR.IA.09 memenuhi kriteria VATM.",
        })),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setStatus(null);

    try {
      const fd = new FormData();
      fd.append("batchId", batchId);
      fd.append("assesseeId", assesseeId);
      if (sourceFileId) fd.append("sourceFileId", sourceFileId);
      fd.append("overallRecommendation", overall);
      fd.append("assessorNotes", notes);
      fd.append("applyToUnitDecisions", applyToDecisions ? "true" : "false");
      fd.append("questionsJson", JSON.stringify(questions));
      fd.append("unitsJson", JSON.stringify(units));

      const res = await saveInterviewAssessmentAction(fd);
      if (!res.ok) {
        setStatus({
          type: "error",
          text: res.error || "Gagal menyimpan penilaian wawancara.",
        });
        return;
      }

      setStatus({
        type: "success",
        text: res.message || "Penilaian wawancara tersimpan.",
      });
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Structured Questions & Answers (FR.IA.09 Table 4) */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Pertanyaan &amp; Kesimpulan Jawaban Wawancara (FR.IA.09)
            </h2>
            <p className="text-xs text-slate-500">
              Catat kesimpulan jawaban asesi dan tentukan pencapaian Ya / Tidak per butir wawancara.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setQuestions((prev) => [
                ...prev,
                {
                  no: prev.length + 1,
                  question: "",
                  answerSummary: "",
                  achieved: null,
                },
              ])
            }
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
          >
            + Tambah Pertanyaan
          </button>
        </div>

        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Pertanyaan #{q.no} {q.unitCode ? `(${q.unitCode})` : ""}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => updateQuestion(idx, { achieved: "Ya" })}
                    className={`px-3 py-1 rounded-lg border font-medium cursor-pointer ${
                      q.achieved === "Ya"
                        ? "bg-emerald-700 border-emerald-700 text-white"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    Ya
                  </button>
                  <button
                    type="button"
                    onClick={() => updateQuestion(idx, { achieved: "Tidak" })}
                    className={`px-3 py-1 rounded-lg border font-medium cursor-pointer ${
                      q.achieved === "Tidak"
                        ? "bg-rose-700 border-rose-700 text-white"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    Tidak
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={q.question}
                onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                placeholder="Pertanyaan wawancara mengacu pada bukti portofolio..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
              <textarea
                rows={2}
                value={q.answerSummary}
                onChange={(e) => updateQuestion(idx, { answerSummary: e.target.value })}
                placeholder="Kesimpulan jawaban asesi..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Per-Unit VATM Impact & Overall Binary Recommendation */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Dampak ke Unit Kompetensi (Roll-Up VATM) &amp; Rekomendasi Wawancara
            </h2>
            <p className="text-xs text-slate-500">
              Hasil wawancara digabung dengan kanal DIT dan Tertulis pada roll-up keputusan per unit (D16).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleOverallSelect("K")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                overall === "K"
                  ? "bg-emerald-700 border-emerald-700 text-white"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> K — Kompeten
            </button>
            <button
              type="button"
              onClick={() => handleOverallSelect("BK")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                overall === "BK"
                  ? "bg-rose-700 border-rose-700 text-white"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              <XCircle className="w-4 h-4" /> BK — Belum Kompeten
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {units.map((u, idx) => (
            <div
              key={u.unitCode}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] text-slate-500">{u.unitCode}</div>
                <div className="font-medium text-slate-900">{u.unitTitle}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateUnitRec(idx, "K")}
                  className={`px-3 py-1 rounded-lg border font-semibold cursor-pointer ${
                    u.recommendation === "K"
                      ? "bg-emerald-700 border-emerald-700 text-white"
                      : "bg-white border-slate-300 text-slate-700"
                  }`}
                >
                  K
                </button>
                <button
                  type="button"
                  onClick={() => updateUnitRec(idx, "BK")}
                  className={`px-3 py-1 rounded-lg border font-semibold cursor-pointer ${
                    u.recommendation === "BK"
                      ? "bg-rose-700 border-rose-700 text-white"
                      : "bg-white border-slate-300 text-slate-700"
                  }`}
                >
                  BK
                </button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="assessorNotes" className="block text-xs font-semibold text-slate-700 mb-1">
            Catatan Asesor (wajib diisi jika BK)
          </label>
          <textarea
            id="assessorNotes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catat bukti kunci yang dikonfirmasi selama wawancara atau alasan tindak lanjut BK..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={applyToDecisions}
            onChange={(e) => setApplyToDecisions(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span>
            Terapkan hasil wawancara ini ke Keputusan Per Unit (FR.AK.02 &amp; roll-up FR.AK.05)
          </span>
        </label>

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
          className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving
            ? "Menyimpan Penilaian Wawancara..."
            : "Simpan Penilaian Wawancara & Perbarui Roll-Up VATM"}
        </button>
      </div>
    </form>
  );
}
