"use client";
// Client interactivity required for assessor/admin final-call manual override on AK.02 & AK.05 roll-up decisions.

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw, ShieldAlert, XCircle } from "lucide-react";

interface OverallDecisionOverrideProps {
  batchId: string;
  assesseeId: string;
  autoRecommendation: "K" | "BK" | null;
  finalRecommendation: "K" | "BK" | null;
  isOverridden: boolean;
  overrideReason: string | null;
  overriddenAt: string | null;
  decidedCount: number;
  kCount: number;
  bkCount: number;
  totalSchemeUnits: number;
  bkUnitLabels: string[];
  canOverride: boolean;
  onSaveOverrideAction: (formData: FormData) => Promise<{
    ok: boolean;
    message?: string;
    error?: string;
  }>;
}

export function OverallDecisionOverrideCard(props: OverallDecisionOverrideProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<"K" | "BK" | "AUTO">(
    props.isOverridden && props.finalRecommendation ? props.finalRecommendation : "AUTO",
  );
  const [reason, setReason] = useState(props.overrideReason ?? "");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const submitMode = (mode: "K" | "BK" | "AUTO") => {
    setFeedback(null);
    const trimmedReason = reason.trim();
    if ((mode === "K" || mode === "BK") && trimmedReason.length < 5) {
      setFeedback({
        type: "error",
        text: "Alasan keputusan manual (minimal 5 karakter) wajib diisi sebagai dasar audit.",
      });
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("batchId", props.batchId);
      fd.append("assesseeId", props.assesseeId);
      fd.append("overrideDecision", mode);
      fd.append(
        "overrideReason",
        mode === "AUTO" ? trimmedReason || "Dikembalikan ke roll-up otomatis" : trimmedReason,
      );

      const res = await props.onSaveOverrideAction(fd);
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error || "Gagal menyimpan keputusan akhir asesor.",
        });
        return;
      }

      setSelected(mode);
      if (mode === "AUTO") {
        setReason("");
      }
      setFeedback({
        type: "success",
        text: res.message || "Keputusan akhir AK.02 & AK.05 diperbarui.",
      });
      router.refresh();
    });
  };

  const finalLabel =
    props.finalRecommendation === "K"
      ? "K — Kompeten"
      : props.finalRecommendation === "BK"
        ? "BK — Belum Kompeten"
        : "Belum Diputuskan";

  const finalBadgeClass =
    props.finalRecommendation === "K"
      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
      : props.finalRecommendation === "BK"
        ? "bg-rose-50 border-rose-300 text-rose-800"
        : "bg-slate-100 border-slate-300 text-slate-700";

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4 border border-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Keputusan Akhir Asesi (FR.AK.02 &amp; FR.AK.05)
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${finalBadgeClass}`}
            >
              {finalLabel}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white border border-slate-300 text-slate-700">
              {props.isOverridden
                ? "Override Manual Asesor (Final Call)"
                : props.autoRecommendation
                  ? "Roll-Up Otomatis Unit"
                  : "Menunggu Keputusan Unit"}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Aturan otomatis: apabila minimal <strong>1 unit kompetensi bertanda BK</strong>,
            rekomendasi AK.02 &amp; AK.05 otomatis menjadi <strong>BK</strong>. Status K otomatis
            hanya muncul bila seluruh {props.totalSchemeUnits} unit selesai dinilai K tanpa BK.
          </p>
        </div>

        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right">
          <div>
            Progress Unit:{" "}
            <strong className="text-slate-900">
              {props.decidedCount}/{props.totalSchemeUnits}
            </strong>{" "}
            ({props.kCount} K · {props.bkCount} BK)
          </div>
          <div>
            Roll-Up Otomatis:{" "}
            <strong className="text-slate-900">
              {props.autoRecommendation ?? "Belum diputuskan"}
            </strong>
          </div>
        </div>
      </div>

      {props.bkUnitLabels.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-900">
          <strong>Unit bertanda BK ({props.bkUnitLabels.length}):</strong>{" "}
          {props.bkUnitLabels.join("; ")}
        </div>
      )}

      {props.isOverridden && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            Override Manual Aktif — Keputusan Asesor Menjadi Keputusan Akhir
          </div>
          <div>
            Alasan Asesor: <span className="font-medium">{props.overrideReason || "-"}</span>
          </div>
          {props.overriddenAt && (
            <div className="text-[11px] text-amber-800">
              Ditetapkan pada: {new Date(props.overriddenAt).toLocaleString("id-ID")}
            </div>
          )}
        </div>
      )}

      {props.canOverride ? (
        <div className="pt-2 border-t border-slate-200 space-y-3">
          <div>
            <label
              htmlFor="overrideReason"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Pertimbangan / Alasan Override Manual Asesor (wajib diisi apabila memilih K atau BK
              secara manual)
            </label>
            <textarea
              id="overrideReason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              placeholder="Contoh: Berdasarkan klarifikasi wawancara langsung dan verifikasi dokumen tambahan, asesi memenuhi standar kompetensi unit terkait..."
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => submitMode("K")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                selected === "K" && props.isOverridden
                  ? "bg-emerald-700 border-emerald-700 text-white"
                  : "bg-white hover:bg-emerald-50 border-emerald-300 text-emerald-800"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Override Final: K (Kompeten)
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => submitMode("BK")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                selected === "BK" && props.isOverridden
                  ? "bg-rose-700 border-rose-700 text-white"
                  : "bg-white hover:bg-rose-50 border-rose-300 text-rose-800"
              }`}
            >
              <XCircle className="w-4 h-4" />
              Override Final: BK (Belum Kompeten)
            </button>
            {props.isOverridden && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => submitMode("AUTO")}
                className="px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Kembalikan ke Roll-Up Otomatis
              </button>
            )}
          </div>

          {feedback && (
            <div
              className={`p-2.5 rounded-xl text-xs border ${
                feedback.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
          Mode baca-saja: hanya Asesor tertugaskan atau Admin LSP yang dapat menetapkan override
          keputusan akhir.
        </p>
      )}
    </div>
  );
}
