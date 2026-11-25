"use client";
// Client interactivity required for reviewing AI-proposed 04B ratings, editing Ya/Tidak/Belum decisions, and submitting assessor-confirmed ratings.

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
  Ia04bAiItemProposal,
  Ia04bAiProposal,
  Official04bAssessment,
  Official04bItemRating,
} from "@/lib/forms/assessee-forms";
import type { SchemeKelompokSpec } from "@/repositories/schemes.repository";
import { saveIa04bAssessmentAction } from "../actions";

interface Ia04bAssessmentFormProps {
  batchId: string;
  assesseeId: string;
  kelompokPekerjaan: SchemeKelompokSpec[];
  initialAssessment: Official04bAssessment;
  hasSavedAssessment: boolean;
  aiProposal: Ia04bAiProposal;
}

function aspectKey(kpIndex: number, no: number): string {
  return `${kpIndex}-${no}`;
}

function buildInitialItems(
  kelompokPekerjaan: SchemeKelompokSpec[],
  savedItems: Official04bItemRating[],
  hasSavedAssessment: boolean,
  aiProposal: Ia04bAiProposal,
): Official04bItemRating[] {
  return kelompokPekerjaan.flatMap((kp) =>
    kp.aspects.map((asp) => {
      if (hasSavedAssessment) {
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
      }

      const proposed = aiProposal.items.find(
        (p) => p.kpIndex === kp.kpIndex && p.no === asp.no,
      );
      return {
        kpIndex: kp.kpIndex,
        no: asp.no,
        unitCode: asp.unitCode,
        achieved: proposed ? proposed.achieved : null,
        note: "",
      };
    }),
  );
}

type ProvenanceBadge = {
  label: string;
  tone: "amber" | "teal" | "emerald" | "slate";
};

function badgeClassName(tone: ProvenanceBadge["tone"]): string {
  if (tone === "amber") {
    return "bg-amber-100 text-amber-900 border-amber-300";
  }
  if (tone === "teal") {
    return "bg-teal-100 text-teal-900 border-teal-300";
  }
  if (tone === "emerald") {
    return "bg-emerald-100 text-emerald-900 border-emerald-300";
  }
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function resolveItemProvenance(params: {
  isSaved: boolean;
  isTouched: boolean;
  val: boolean | null;
  proposal?: Ia04bAiItemProposal;
}): ProvenanceBadge {
  const { isSaved, isTouched, val, proposal } = params;
  if (isSaved) {
    if (isTouched) {
      return { label: "Diubah (Belum Disimpan)", tone: "amber" };
    }
    if (proposal?.sourceStatus != null && proposal.achieved !== val) {
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
  if (proposal?.sourceStatus === "Sebagian") {
    return { label: "Usulan AI: Sebagian (Perlu Nilai Asesor)", tone: "amber" };
  }
  if (proposal?.sourceStatus === "Terpenuhi" || proposal?.sourceStatus === "Belum Dibahas") {
    return { label: "Usulan AI", tone: "amber" };
  }
  return { label: "Belum Dinilai", tone: "slate" };
}

function resolveOverallProvenance(params: {
  isSaved: boolean;
  overallTouched: boolean;
  overall: "K" | "BK" | null;
  proposedOverall: "K" | "BK" | null;
}): ProvenanceBadge {
  const { isSaved, overallTouched, overall, proposedOverall } = params;
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
  return { label: "Belum Ditetapkan", tone: "slate" };
}

export function Ia04bAssessmentForm({
  batchId,
  assesseeId,
  kelompokPekerjaan,
  initialAssessment,
  hasSavedAssessment,
  aiProposal,
}: Ia04bAssessmentFormProps) {
  const router = useRouter();
  const [items, setItems] = useState<Official04bItemRating[]>(() =>
    buildInitialItems(
      kelompokPekerjaan,
      initialAssessment.items,
      hasSavedAssessment,
      aiProposal,
    ),
  );
  const [overall, setOverall] = useState<"K" | "BK" | null>(() =>
    hasSavedAssessment
      ? initialAssessment.overallRecommendation
      : aiProposal.hasProposal
        ? aiProposal.overallRecommendation
        : null,
  );
  const [assessorNotes, setAssessorNotes] = useState(initialAssessment.assessorNotes ?? "");
  const [isSaved, setIsSaved] = useState(hasSavedAssessment);
  const [touchedItems, setTouchedItems] = useState<Set<string>>(() => new Set());
  const [overallTouched, setOverallTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const proposalByKey = useMemo(() => {
    const map = new Map<string, Ia04bAiItemProposal>();
    for (const p of aiProposal.items) {
      map.set(aspectKey(p.kpIndex, p.no), p);
    }
    return map;
  }, [aiProposal.items]);

  const setAspectAchieved = (kpIndex: number, no: number, achieved: boolean | null) => {
    const key = aspectKey(kpIndex, no);
    setItems((prev) =>
      prev.map((item) =>
        item.kpIndex === kpIndex && item.no === no ? { ...item, achieved } : item,
      ),
    );
    setTouchedItems((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    if (achieved === false) {
      setOverall("BK");
      setOverallTouched(true);
    }
  };

  const setAspectNote = (kpIndex: number, no: number, note: string) => {
    const key = aspectKey(kpIndex, no);
    setItems((prev) =>
      prev.map((item) =>
        item.kpIndex === kpIndex && item.no === no ? { ...item, note } : item,
      ),
    );
    setTouchedItems((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const handleSelectOverall = (nextOverall: "K" | "BK" | null) => {
    setOverall(nextOverall);
    setOverallTouched(true);
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
      setIsSaved(true);
      setTouchedItems(new Set());
      setOverallTouched(false);
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

  const overallBadge = resolveOverallProvenance({
    isSaved,
    overallTouched,
    overall,
    proposedOverall: aiProposal.overallRecommendation,
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
              Pengisian Penilaian FR.IA.04B oleh Asesor (Formulir Mandiri)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Nilai awal formulir diisi otomatis sebagai <strong>usulan AI</strong> dari analisis DIT
              (<em>Terpenuhi</em> &rarr; Ya, <em>Belum Dibahas</em> &rarr; Tidak,{" "}
              <em>Sebagian</em> &rarr; Belum). Periksa dan koreksi bila diperlukan, lalu klik{" "}
              <strong>Simpan</strong> untuk menetapkan keputusan resmi asesor pada blanko &amp; ekspor DOCX.
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
          Ya: {items.filter((i) => i.achieved === true).length} · Tidak:{" "}
          {items.filter((i) => i.achieved === false).length} · Belum:{" "}
          {items.filter((i) => i.achieved === null).length}
        </div>
      </div>

      {/* Form-level provenance status banner */}
      {isSaved ? (
        <div
          data-testid="ia04b-provenance-banner"
          className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>Keputusan Tersimpan (Asesor)</strong> — Penilaian resmi FR.IA.04B sudah ditetapkan.
              {(touchedItems.size > 0 || overallTouched) &&
                " Ada perubahan lokal yang belum disimpan."}
            </span>
          </div>
          {aiProposal.readinessPct !== null && (
            <span className="font-mono text-[11px] bg-white border border-emerald-200 px-2 py-0.5 rounded">
              Kesiapan DIT AI: {aiProposal.readinessPct}% ({aiProposal.overallRecommendation ?? "-"})
            </span>
          )}
        </div>
      ) : aiProposal.hasProposal ? (
        <div
          data-testid="ia04b-provenance-banner"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 space-y-1"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Usulan AI dari DIT (Belum Disimpan — Menunggu Keputusan Asesor)</span>
            </div>
            {aiProposal.readinessPct !== null && (
              <span className="font-mono text-[11px] bg-white border border-amber-200 px-2 py-0.5 rounded">
                Kesiapan DIT: {aiProposal.readinessPct}% · Usulan:{" "}
                {aiProposal.overallRecommendation ?? "-"}
              </span>
            )}
          </div>
          {aiProposal.readinessNote && (
            <p className="text-[11px] text-amber-900">{aiProposal.readinessNote}</p>
          )}
        </div>
      ) : (
        <div
          data-testid="ia04b-provenance-banner"
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-600"
        >
          <strong>Belum Dinilai</strong> — Jalankan analisis DIT untuk mendapatkan usulan otomatis AI,
          atau isi penilaian secara manual lalu simpan.
        </div>
      )}

      <div className="space-y-4">
        {kelompokPekerjaan.map((kp) => (
          <div key={kp.kpIndex} className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              {kp.title}
            </div>
            <div className="space-y-2.5">
              {kp.aspects.map((asp) => {
                const key = aspectKey(kp.kpIndex, asp.no);
                const current = items.find(
                  (i) => i.kpIndex === kp.kpIndex && i.no === asp.no,
                );
                const val = current?.achieved ?? null;
                const proposal = proposalByKey.get(key);
                const isTouched = touchedItems.has(key);
                const badge = resolveItemProvenance({
                  isSaved,
                  isTouched,
                  val,
                  proposal,
                });
                const cardHighlight =
                  !isSaved && !isTouched && proposal?.sourceStatus != null
                    ? "bg-amber-50/40 border-amber-200"
                    : isTouched
                      ? "bg-teal-50/40 border-teal-200"
                      : "bg-slate-50 border-slate-200";

                return (
                  <div
                    key={key}
                    data-testid={`ia04b-item-${key}`}
                    className={`p-3 rounded-xl border space-y-2 ${cardHighlight}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">
                            {asp.no}. {asp.lingkup}{" "}
                            <span className="font-mono text-[11px] font-normal text-slate-500">
                              ({asp.unitCode})
                            </span>
                          </span>
                          <span
                            data-testid={`ia04b-badge-${key}`}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClassName(badge.tone)}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">{asp.question}</p>
                        <p className="text-[11px] text-slate-500">{asp.kukRef}</p>
                        {proposal?.sourceStatus && (
                          <p className="text-[11px] text-slate-600 bg-white/80 border border-slate-200 rounded-lg px-2 py-1">
                            <strong>Status DIT AI:</strong> {proposal.sourceStatus}
                            {proposal.evidenceSpan ? ` — "${proposal.evidenceSpan}"` : ""}
                          </p>
                        )}
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">
              Rekomendasi Keseluruhan FR.IA.04B (Biner K / BK)
            </span>
            <span
              data-testid="ia04b-overall-badge"
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClassName(overallBadge.tone)}`}
            >
              {overallBadge.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSelectOverall("K")}
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
              onClick={() => handleSelectOverall("BK")}
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
              onClick={() => handleSelectOverall(null)}
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
