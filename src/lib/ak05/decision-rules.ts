import { readField, readStringField } from "@/lib/utils/record-fields";

export interface Ak05RollupRow {
  no: number;
  assesseeId: string;
  assesseeName: string;
  recommendation: "K" | "BK" | "-";
  keterangan: string;
  undecided: boolean;
  decisionSource?: "auto_rollup" | "manual_override" | "undecided";
  autoRecommendation?: "K" | "BK" | null;
  overrideReason?: string | null;
}

export interface UnitDecisionLike {
  assesseeId?: string;
  assessee_id?: string;
  unitCode?: string;
  unit_code?: string;
  unitTitle?: string;
  unit_title?: string;
  decision?: string | null;
}

export interface OverallDecisionOverrideLike {
  overrideDecision?: "K" | "BK" | null;
  override_decision?: "K" | "BK" | null;
  overrideReason?: string | null;
  override_reason?: string | null;
  overriddenBy?: string | null;
  overridden_by?: string | null;
  overriddenAt?: string | null;
  overridden_at?: string | null;
}

export interface ResolvedOverallDecision {
  recommendation: "K" | "BK" | null;
  autoRecommendation: "K" | "BK" | null;
  source: "auto_rollup" | "manual_override" | "undecided";
  undecided: boolean;
  isOverridden: boolean;
  overrideReason: string | null;
  overriddenAt: string | null;
  decidedCount: number;
  kCount: number;
  bkCount: number;
  totalSchemeUnits: number | null;
  bkUnitLabels: string[];
  keterangan: string;
}

function formatUnitLabels(units: UnitDecisionLike[]): string[] {
  return units
    .map((u) => {
      const row = u as unknown as Record<string, unknown>;
      const code = readStringField(row, "unitCode", "unit_code");
      const title = readStringField(row, "unitTitle", "unit_title");
      if (code && title) return `${code} (${title})`;
      return code || title;
    })
    .filter(Boolean);
}

export const OVERALL_DECISION_RULE_LEAD =
  "Aturan otomatis: apabila minimal 1 unit kompetensi bertanda BK, rekomendasi AK.02 & AK.05 otomatis menjadi BK.";

export function formatOverallDecisionRuleSummary(totalSchemeUnits: number): string {
  return `${OVERALL_DECISION_RULE_LEAD} Status K otomatis hanya muncul bila seluruh ${totalSchemeUnits} unit selesai dinilai K tanpa BK.`;
}

/**
 * Pure deterministic overall recommendation resolver (safe for both server and client bundles):
 * 1. Zero decided units -> undecided (`null` / `"-"` / `"Belum diputuskan"`).
 * 2. Even ONE unit marked `"BK"` -> immediate automatic `"BK"` (regardless of remaining K/undecided units).
 * 3. Partial `"K"` with remaining scheme units undecided and zero `"BK"` -> remains undecided until all units decided.
 * 4. Authorized assessor/admin manual override (`K` or `BK`) always serves as the final call.
 */
export function resolveAssesseeOverallDecision(params: {
  unitDecisions: UnitDecisionLike[];
  totalSchemeUnits?: number | null;
  manualOverride?: OverallDecisionOverrideLike | null;
}): ResolvedOverallDecision {
  const decided = params.unitDecisions.filter(
    (d) => d.decision === "K" || d.decision === "BK",
  );
  const bkUnits = decided.filter((d) => d.decision === "BK");
  const kUnits = decided.filter((d) => d.decision === "K");
  const bkUnitLabels = formatUnitLabels(bkUnits);

  const rawTotal = params.totalSchemeUnits ?? null;
  const totalSchemeUnits =
    typeof rawTotal === "number" && rawTotal > 0 ? rawTotal : null;

  let autoRecommendation: "K" | "BK" | null = null;
  let autoKeterangan = "Belum diputuskan";

  if (decided.length === 0) {
    autoRecommendation = null;
    autoKeterangan = "Belum diputuskan";
  } else if (bkUnits.length > 0) {
    autoRecommendation = "BK";
    autoKeterangan = bkUnitLabels.join("; ") || "Unit belum kompeten";
  } else if (totalSchemeUnits !== null && kUnits.length < totalSchemeUnits) {
    autoRecommendation = null;
    autoKeterangan = `Belum diputuskan (${kUnits.length}/${totalSchemeUnits} unit K)`;
  } else {
    autoRecommendation = "K";
    autoKeterangan = "";
  }

  const overrideRow = params.manualOverride as Record<string, unknown> | null | undefined;
  const rawOverrideDecision = readField<string | null>(
    overrideRow,
    "overrideDecision",
    "override_decision",
  );
  const overrideDecision =
    rawOverrideDecision === "K" || rawOverrideDecision === "BK"
      ? rawOverrideDecision
      : null;
  const overrideReason =
    readStringField(overrideRow, "overrideReason", "override_reason") || null;
  const overriddenAt =
    readField<string | null>(overrideRow, "overriddenAt", "overridden_at") ?? null;

  if (overrideDecision) {
    const manualKeterangan = overrideReason
      ? `Keputusan Manual Asesor: ${overrideReason}`
      : "Keputusan Manual Asesor";
    return {
      recommendation: overrideDecision,
      autoRecommendation,
      source: "manual_override",
      undecided: false,
      isOverridden: true,
      overrideReason,
      overriddenAt,
      decidedCount: decided.length,
      kCount: kUnits.length,
      bkCount: bkUnits.length,
      totalSchemeUnits,
      bkUnitLabels,
      keterangan: manualKeterangan,
    };
  }

  return {
    recommendation: autoRecommendation,
    autoRecommendation,
    source: autoRecommendation ? "auto_rollup" : "undecided",
    undecided: autoRecommendation === null,
    isOverridden: false,
    overrideReason: null,
    overriddenAt: null,
    decidedCount: decided.length,
    kCount: kUnits.length,
    bkCount: bkUnits.length,
    totalSchemeUnits,
    bkUnitLabels,
    keterangan: autoKeterangan,
  };
}

/**
 * Pure deterministic FR.AK.05 row builder (client-safe).
 */
export function computeAk05RowForAssessee(params: {
  no: number;
  assessee: {
    id: string;
    displayName: string;
    certificateNameConfirmed?: string | null;
  };
  unitDecisions: UnitDecisionLike[];
  totalSchemeUnits?: number | null;
  manualOverride?: OverallDecisionOverrideLike | null;
}): Ak05RollupRow {
  const assesseeName =
    params.assessee.certificateNameConfirmed || params.assessee.displayName;
  const resolved = resolveAssesseeOverallDecision({
    unitDecisions: params.unitDecisions,
    totalSchemeUnits: params.totalSchemeUnits,
    manualOverride: params.manualOverride,
  });

  return {
    no: params.no,
    assesseeId: params.assessee.id,
    assesseeName,
    recommendation: resolved.recommendation ?? "-",
    keterangan: resolved.keterangan,
    undecided: resolved.undecided,
    decisionSource: resolved.source,
    autoRecommendation: resolved.autoRecommendation,
    overrideReason: resolved.overrideReason,
  };
}
