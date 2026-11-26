"use client";
// Client interactivity required for reviewing AI-proposed FR.IA.06C written verdicts, editing answers/Ya/Tidak/Belum ratings, and submitting assessor-confirmed decisions.

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";
import type {
  Ia06cAiItemProposal,
  Ia06cAiProposal,
  Official06cAssessment,
  Official06cItemRating,
} from "@/lib/forms/assessee-forms";
import type { SchemeWrittenQuestionSpec } from "@/repositories/schemes.repository";
import { saveIa06cAssessmentAction } from "../actions";

interface Ia06cAssessmentFormProps {
  batchId: string;
  assesseeId: string;
  schemeQuestions: SchemeWrittenQuestionSpec[];
  initialAssessment: Official06cAssessment;
  hasSavedAssessment: boolean;
  aiProposal: Ia06cAiProposal;
}

type ProvenanceBadge = {
  label: string;
  tone: "amber" | "teal" | "emerald" | "slate";
};

function badgeClassName(tone: ProvenanceBadge["tone"]): string {
  if (tone === "amber") return "bg-amber-100 text-amber-900 border-amber-300";
  if (tone === "teal") return "bg-teal-100 text-teal-900 border-teal-300";
  if (tone === "emerald") return "bg-emerald-100 text-emerald-900 border-emerald-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function buildInitialItems(params: {
  initialAssessment: Official06cAssessment;
  hasSavedAssessment: boolean;
  aiProposal: Ia06cAiProposal;
  schemeQuestions: SchemeWrittenQuestionSpec[];
}): Official06cItemRating[] {
  const { initialAssessment, hasSavedAssessment, aiProposal, schemeQuestions } = params;
  const totalSlots = Math.max(
    aiProposal.items.length,
    initialAssessment.items.length,
    schemeQuestions.length,
    1,
  );

  return Array.from({ length: totalSlots }).map((_, idx) => {
    const qNo = idx + 1;
    const aiItem = aiProposal.items.find((p) => p.questionNo === qNo) ?? aiProposal.items[idx];
    if (hasSavedAssessment) {
      const saved =
        initialAssessment.items.find((s) => s.questionNo === qNo) ??
        initialAssessment.items[idx];
      return {
        questionNo: qNo,
        answerText: saved?.answerText?.trim()
          ? saved.answerText
          : (aiItem?.answerText ?? ""),
        achieved: saved ? saved.achieved : null,
        note: saved?.note ?? "",
      };
    }

    return {
      questionNo: qNo,
      answerText: aiItem?.answerText ?? "",
      achieved: aiItem ? aiItem.achieved : null,
      note: "",
    };
  });
}

function resolveItemProvenance(params: {
  isSaved: boolean;
  isTouched: boolean;
  val: boolean | null;
  proposal?: Ia06cAiItemProposal;
}): ProvenanceBadge {
  const { isSaved, isTouched, val, proposal } = params;
  if (isSaved) {
    if (isTouched) {
      return { label: "Diubah (Belum Disimpan)", tone: "amber" };
    }
    if (proposal?.sourceVerdict != null && proposal.achieved !== val) {
      return { label: "Dikoreksi Asesor", tone: "teal" };
    }
    if (val !== null) {
      return { label: "Ditetapkan Asesor", tone: "emerald" };
    }
    return { label: "Belum Dinilai", tone: "slate" };
  }

  if (isTouched) {
    return { label: "Dikoreksi Asesor (Belum Disimpan)", tone: "teal" };
  }
  if (proposal?.sourceVerdict === "Sebagian") {
    return { label: "Usulan AI: Sebagian (Perlu Nilai Asesor)", tone: "amber" };
  }
  if (proposal?.sourceVerdict === "Benar" || proposal?.sourceVerdict === "Salah") {
    return { label: "Usulan AI", tone: "amber" };
  }
  return { label: "Belum Dinilai", tone: "slate" };
}

function resolveOverallProvenance(params: {
  isSaved: boolean;
  overallTouched: boolean;
  overall: boolean | null;
  proposedOverall: boolean | null;
  hasProposal: boolean;
}): ProvenanceBadge {
  const { isSaved, overallTouched, overall, proposedOverall, hasProposal } = params;
  if (isSaved) {
    if (overallTouched) {
      return { label: "Diubah (Belum Disimpan)", tone: "amber" };
    }
    if (proposedOverall !== null && proposedOverall !== overall) {
      return { label: "Dikoreksi Asesor", tone: "teal" };
    }
    if (overall !== null) {
      return { label: "Ditetapkan Asesor", tone: "emerald" };
    }
    return { label: "Belum Ditetapkan", tone: "slate" };
  }

  if (overallTouched) {
    return { label: "Dikoreksi Asesor (Belum Disimpan)", tone: "teal" };
  }
  if (proposedOverall !== null) {
    return { label: "Usulan AI", tone: "amber" };
  }
  if (hasProposal) {
    return { label: "Usulan AI: Belum Dapat Diputuskan (Perlu Nilai Asesor)", tone: "amber" };
  }
  return { label: "Belum Ditetapkan", tone: "slate" };
}

export function Ia06cAssessmentForm({
  batchId,
  assesseeId,
  schemeQuestions,
  initialAssessment,
  hasSavedAssessment,
  aiProposal,
}: Ia06cAssessmentFormProps) {
  const router = useRouter();
  const [items, setItems] = useState<Official06cItemRating[]>(() =>
    buildInitialItems({
      initialAssessment,
      hasSavedAssessment,
      aiProposal,
      schemeQuestions,
    }),
  );
  const [overallAchieved, setOverallAchieved] = useState<boolean | null>(() =>
    hasSavedAssessment
      ? initialAssessment.overallAchieved
      : aiProposal.hasProposal
        ? aiProposal.overallAchieved
        : null,
  );
  const [feedbackDetail, setFeedbackDetail] = useState<string>(() =>
    hasSavedAssessment
      ? (initialAssessment.feedbackDetail ?? "")
      : aiProposal.hasProposal
        ? aiProposal.feedbackDetail
        : "",
  );
  const [isSaved, setIsSaved] = useState(hasSavedAssessment);
  const [touchedItems, setTouchedItems] = useState<Set<number>>(() => new Set());
  const [overallTouched, setOverallTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const proposalByNo = useMemo(() => {
    const map = new Map<number, Ia06cAiItemProposal>();
    for (const p of aiProposal.items) {
      map.set(p.questionNo, p);
    }
    return map;
  }, [aiProposal.items]);

  const schemeQuestionByNo = useMemo(() => {
    const map = new Map<number, SchemeWrittenQuestionSpec>();
    for (const q of schemeQuestions) {
      map.set(q.no, q);
    }
    return map;
  }, [schemeQuestions]);

  const markTouched = (questionNo: number) => {
    setTouchedItems((prev) => {
      const next = new Set(prev);
      next.add(questionNo);
      return next;
    });
  };

  const setItemAchieved = (questionNo: number, achieved: boolean | null) => {
    setItems((prev) =>
      prev.map((item) =>
        item.questionNo === questionNo ? { ...item, achieved } : item,
      ),
    );
    markTouched(questionNo);
    if (achieved === false) {
      setOverallAchieved(false);
      setOverallTouched(true);
    }
  };

  const setItemAnswerText = (questionNo: number, answerText: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.questionNo === questionNo ? { ...item, answerText } : item,
      ),
    );
    markTouched(questionNo);
  };

  const setItemNote = (questionNo: number, note: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.questionNo === questionNo ? { ...item, note } : item,
      ),
    );
    markTouched(questionNo);
  };

  const handleSelectOverall = (nextVal: boolean | null) => {
    setOverallAchieved(nextVal);
    setOverallTouched(true);
  };

  const handleBulkAchieved = (achieved: true | null) => {
    if (
      isSaved &&
      !window.confirm("Timpa nilai tersimpan pada formulir FR.IA.06C ini?")
    ) {
      return;
    }
    setItems((prev) => prev.map((item) => ({ ...item, achieved })));
    setTouchedItems(new Set(items.map((item) => item.questionNo)));
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
      if (overallAchieved !== null) {
        fd.append("overallAchieved", String(overallAchieved));
      }
      fd.append("feedbackDetail", feedbackDetail);

      const res = await saveIa06cAssessmentAction(fd);
      if (!res.ok) {
        setStatus({ type: "error", text: res.error ?? "Gagal menyimpan formulir FR.IA.06C." });
        return;
      }

      setIsSaved(true);
      setTouchedItems(new Set());
      setOverallTouched(false);
      setStatus({ type: "success", text: res.message ?? "Penilaian FR.IA.06C tersimpan." });
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

  const overallBadge = resolveOverallProvenance({
    isSaved,
    overallTouched,
    overall: overallAchieved,
    proposedOverall: aiProposal.overallAchieved,
    hasProposal: aiProposal.hasProposal,
  });

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
              Pengisian Penilaian FR.IA.06C oleh Asesor (Formulir Mandiri)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Nilai awal formulir diisi otomatis sebagai <strong>usulan AI</strong> dari koreksi
              tertulis (<em>Benar</em> &rarr; Ya, <em>Salah</em> &rarr; Tidak,{" "}
              <em>Sebagian</em> &rarr; Belum). Periksa dan koreksi bila diperlukan, lalu klik{" "}
              <strong>Simpan</strong> untuk menetapkan keputusan resmi asesor pada blanko &amp; ekspor DOCX.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleBulkAchieved(true)}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer"
          >
            Tandai Semua Ya
          </button>
          <button
            type="button"
            onClick={() => handleBulkAchieved(null)}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer"
          >
            Kosongkan
          </button>
          <div className="text-xs font-mono text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
            Ya: {items.filter((i) => i.achieved === true).length} · Tidak:{" "}
            {items.filter((i) => i.achieved === false).length} · Belum:{" "}
            {items.filter((i) => i.achieved === null).length}
          </div>
        </div>
      </div>

      {isSaved ? (
        <div
          data-testid="ia06c-provenance-banner"
          className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-950 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            <strong>Keputusan Tersimpan (Asesor)</strong> — Penilaian resmi FR.IA.06C sudah ditetapkan.
            {(touchedItems.size > 0 || overallTouched) &&
              " Ada perubahan lokal yang belum disimpan."}
          </span>
        </div>
      ) : aiProposal.hasProposal ? (
        <div
          data-testid="ia06c-provenance-banner"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 flex items-center gap-2 font-semibold"
        >
          <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Usulan AI dari Koreksi Tertulis (Belum Disimpan — Menunggu Keputusan Asesor)
          </span>
        </div>
      ) : (
        <div
          data-testid="ia06c-provenance-banner"
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-600"
        >
          <strong>Belum Dinilai</strong> — Jalankan koreksi tertulis AI di atas untuk mendapatkan
          usulan otomatis, atau isi penilaian secara manual lalu simpan.
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const proposal = proposalByNo.get(item.questionNo);
          const schemeQ = schemeQuestionByNo.get(item.questionNo);
          const isTouched = touchedItems.has(item.questionNo);
          const badge = resolveItemProvenance({
            isSaved,
            isTouched,
            val: item.achieved,
            proposal,
          });
          const cardHighlight =
            !isSaved && !isTouched && proposal?.sourceVerdict != null
              ? "bg-amber-50/40 border-amber-200"
              : isTouched
                ? "bg-teal-50/40 border-teal-200"
                : "bg-white border-slate-200";

          return (
            <div
              key={item.questionNo}
              data-testid={`ia06c-item-${item.questionNo}`}
              className={`p-3.5 rounded-xl border space-y-2.5 ${cardHighlight}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Soal #{item.questionNo}
                    </span>
                    {schemeQ?.unitCode && (
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {schemeQ.unitCode}
                      </span>
                    )}
                    <span
                      data-testid={`ia06c-badge-${item.questionNo}`}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClassName(badge.tone)}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {schemeQ?.question && (
                    <p className="text-xs text-slate-700">{schemeQ.question}</p>
                  )}
                  {proposal?.sourceVerdict && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                      <strong>Putusan AI:</strong> {proposal.sourceVerdict}
                      {proposal.explanation ? ` — ${proposal.explanation}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-xs">
                  <button
                    type="button"
                    onClick={() => setItemAchieved(item.questionNo, true)}
                    className={`px-3 py-1 rounded-lg border font-medium cursor-pointer ${
                      item.achieved === true
                        ? "bg-emerald-700 border-emerald-700 text-white"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    Ya
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemAchieved(item.questionNo, false)}
                    className={`px-3 py-1 rounded-lg border font-medium cursor-pointer ${
                      item.achieved === false
                        ? "bg-rose-700 border-rose-700 text-white"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    Tidak
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemAchieved(item.questionNo, null)}
                    className={`px-2.5 py-1 rounded-lg border font-medium cursor-pointer ${
                      item.achieved === null
                        ? "bg-slate-700 border-slate-700 text-white"
                        : "bg-white border-slate-300 text-slate-600"
                    }`}
                  >
                    Belum
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={item.answerText}
                  onChange={(e) => setItemAnswerText(item.questionNo, e.target.value)}
                  placeholder={`Ringkasan jawaban asesi soal #${item.questionNo}...`}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                />
                <input
                  type="text"
                  value={item.note ?? ""}
                  onChange={(e) => setItemNote(item.questionNo, e.target.value)}
                  placeholder="Catatan koreksi asesor untuk soal ini (opsional)..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">
              Umpan Balik Keseluruhan FR.IA.06C (Biner K / BK)
            </span>
            <span
              data-testid="ia06c-overall-badge"
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClassName(overallBadge.tone)}`}
            >
              {overallBadge.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSelectOverall(true)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                overallAchieved === true
                  ? "bg-emerald-700 border-emerald-700 text-white"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Tercapai (K)
            </button>
            <button
              type="button"
              onClick={() => handleSelectOverall(false)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                overallAchieved === false
                  ? "bg-rose-700 border-rose-700 text-white"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" /> Belum Tercapai (BK)
            </button>
            <button
              type="button"
              onClick={() => handleSelectOverall(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer ${
                overallAchieved === null
                  ? "bg-slate-700 border-slate-700 text-white"
                  : "bg-white border-slate-300 text-slate-600"
              }`}
            >
              Belum ditetapkan
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="ia06cFeedbackDetail" className="block text-xs font-semibold text-slate-700 mb-1">
            Catatan Unit/Elemen/KUK FR.IA.06C (wajib diisi jika Belum Tercapai / BK)
          </label>
          <textarea
            id="ia06cFeedbackDetail"
            rows={2}
            value={feedbackDetail}
            onChange={(e) => {
              setFeedbackDetail(e.target.value);
              setOverallTouched(true);
            }}
            placeholder="Catat unit/elemen/KUK atau ringkasan umpan balik tertulis untuk asesi..."
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
          {saving ? "Menyimpan Penilaian FR.IA.06C..." : "Simpan Penilaian FR.IA.06C"}
        </button>
      </div>
    </form>
  );
}
