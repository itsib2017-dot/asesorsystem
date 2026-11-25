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

export interface ChannelVerdictSummary {
  recommendation: "K" | "BK" | null;
  detail?: string;
}

export interface AssesseeChannelVerdicts {
  ia04b?: ChannelVerdictSummary | null;
  ia06c?: ChannelVerdictSummary | null;
  interview?: ChannelVerdictSummary | null;
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
  bkChannelLabels?: string[];
  keterangan: string;
}

function readOfficial04bChannelVerdict(
  ditAnalysis?: Record<string, unknown> | null,
): ChannelVerdictSummary | null {
  if (!ditAnalysis || typeof ditAnalysis !== "object") return null;
  const raw = readField<Record<string, unknown>>(ditAnalysis, "official04b", "official_04b");
  if (!raw || typeof raw !== "object") return null;

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
  );
  const overall =
    raw.overallRecommendation === "K" || raw.overallRecommendation === "BK"
      ? raw.overallRecommendation
      : null;
  const hasSaved =
    items.length > 0 ||
    overall !== null ||
    Boolean(raw.assessedAt) ||
    Boolean(raw.assessedBy);
  if (!hasSaved) return null;

  const failedItems = items.filter((item) => item.achieved === false);
  if (overall === "BK" || failedItems.length > 0) {
    const failedCodes = failedItems
      .map((item) => String(item.unitCode ?? "").trim())
      .filter(Boolean);
    const detail =
      failedCodes.length > 0
        ? `FR.IA.04B: BK (${failedCodes.join(", ")})`
        : failedItems.length > 0
          ? `FR.IA.04B: BK (${failedItems.length} aspek Tidak)`
          : "FR.IA.04B: BK";
    return { recommendation: "BK", detail };
  }

  if (overall === "K" && (items.length === 0 || items.every((item) => item.achieved === true))) {
    return { recommendation: "K" };
  }
  return { recommendation: null };
}

function readOfficial06cChannelVerdict(
  writtenGrading?: Record<string, unknown> | null,
): ChannelVerdictSummary | null {
  if (!writtenGrading || typeof writtenGrading !== "object") return null;
  const direct = readField<Record<string, unknown>>(writtenGrading, "official06c", "official_06c");
  const mapping = readField<Record<string, unknown>>(writtenGrading, "formMapping", "form_mapping");
  const raw =
    direct && typeof direct === "object"
      ? direct
      : mapping &&
          typeof mapping === "object" &&
          mapping.official06c &&
          typeof mapping.official06c === "object"
        ? (mapping.official06c as Record<string, unknown>)
        : undefined;
  if (!raw || typeof raw !== "object") return null;

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
  );
  const overallAchieved =
    raw.overallAchieved === true ? true : raw.overallAchieved === false ? false : null;
  const confirmedBy = readField<unknown>(writtenGrading, "confirmedBy", "confirmed_by");
  const confirmedAt = readField<unknown>(writtenGrading, "confirmedAt", "confirmed_at");
  const hasSaved =
    items.length > 0 ||
    overallAchieved !== null ||
    Boolean(raw.assessedAt) ||
    Boolean(raw.assessedBy) ||
    Boolean(confirmedAt) ||
    Boolean(confirmedBy);
  if (!hasSaved) return null;

  const failedItems = items.filter((item) => item.achieved === false);
  if (overallAchieved === false || failedItems.length > 0) {
    const detail =
      failedItems.length > 0
        ? `FR.IA.06C: BK (${failedItems.length} soal Tidak)`
        : "FR.IA.06C: BK";
    return { recommendation: "BK", detail };
  }

  if (
    overallAchieved === true &&
    (items.length === 0 || items.every((item) => item.achieved === true))
  ) {
    return { recommendation: "K" };
  }
  return { recommendation: null };
}

function readInterviewChannelVerdict(
  interviewAssessment?: Record<string, unknown> | null,
): ChannelVerdictSummary | null {
  if (!interviewAssessment || typeof interviewAssessment !== "object") return null;
  const raw = readField<unknown>(
    interviewAssessment,
    "overallRecommendation",
    "overall_recommendation",
  );
  if (raw === "BK") {
    return { recommendation: "BK", detail: "FR.IA.09 Wawancara: BK" };
  }
  if (raw === "K") {
    return { recommendation: "K" };
  }
  return null;
}

/**
 * Extracts official assessor-saved verdicts across FR.IA.04B, FR.IA.06C, and FR.IA.09.
 * Unsaved AI proposals are never treated as official channel decisions.
 */
export function deriveOfficialChannelVerdicts(params: {
  ditAnalysis?: Record<string, unknown> | null;
  writtenGrading?: Record<string, unknown> | null;
  interviewAssessment?: Record<string, unknown> | null;
}): AssesseeChannelVerdicts {
  return {
    ia04b: readOfficial04bChannelVerdict(params.ditAnalysis),
    ia06c: readOfficial06cChannelVerdict(params.writtenGrading),
    interview: readInterviewChannelVerdict(params.interviewAssessment),
  };
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
  "Aturan otomatis: apabila minimal 1 unit kompetensi atau kanal penilaian tersimpan (FR.IA.04B / FR.IA.06C / FR.IA.09) bertanda BK, rekomendasi AK.02 & AK.05 otomatis menjadi BK.";

export function formatOverallDecisionRuleSummary(totalSchemeUnits: number): string {
  return `${OVERALL_DECISION_RULE_LEAD} Status K otomatis hanya muncul bila seluruh ${totalSchemeUnits} unit selesai dinilai K tanpa BK di kanal mana pun.`;
}

/**
 * Pure deterministic overall recommendation resolver (safe for both server and client bundles):
 * 1. Even ONE unit or saved assessment channel (04B/06C/09) marked `"BK"` -> immediate automatic `"BK"`.
 * 2. Zero decided units (and zero BK channels) -> undecided (`null` / `"-"` / `"Belum diputuskan"`).
 * 3. Partial `"K"` with remaining scheme units undecided and zero `"BK"` -> remains undecided until all units decided.
 * 4. Authorized assessor/admin manual override (`K` or `BK`) always serves as the final call.
 */
export function resolveAssesseeOverallDecision(params: {
  unitDecisions: UnitDecisionLike[];
  totalSchemeUnits?: number | null;
  manualOverride?: OverallDecisionOverrideLike | null;
  channelVerdicts?: AssesseeChannelVerdicts | null;
}): ResolvedOverallDecision {
  const decided = params.unitDecisions.filter(
    (d) => d.decision === "K" || d.decision === "BK",
  );
  const bkUnits = decided.filter((d) => d.decision === "BK");
  const kUnits = decided.filter((d) => d.decision === "K");
  const bkUnitLabels = formatUnitLabels(bkUnits);

  const bkChannelLabels: string[] = [];
  if (params.channelVerdicts?.ia04b?.recommendation === "BK") {
    bkChannelLabels.push(params.channelVerdicts.ia04b.detail || "FR.IA.04B: BK");
  }
  if (params.channelVerdicts?.ia06c?.recommendation === "BK") {
    bkChannelLabels.push(params.channelVerdicts.ia06c.detail || "FR.IA.06C: BK");
  }
  if (params.channelVerdicts?.interview?.recommendation === "BK") {
    bkChannelLabels.push(params.channelVerdicts.interview.detail || "FR.IA.09 Wawancara: BK");
  }

  const rawTotal = params.totalSchemeUnits ?? null;
  const totalSchemeUnits =
    typeof rawTotal === "number" && rawTotal > 0 ? rawTotal : null;

  let autoRecommendation: "K" | "BK" | null = null;
  let autoKeterangan = "Belum diputuskan";

  if (bkUnits.length > 0 || bkChannelLabels.length > 0) {
    autoRecommendation = "BK";
    autoKeterangan =
      [...bkUnitLabels, ...bkChannelLabels].join("; ") || "Unit belum kompeten";
  } else if (decided.length === 0) {
    autoRecommendation = null;
    autoKeterangan = "Belum diputuskan";
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
      bkChannelLabels,
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
    bkChannelLabels,
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
  channelVerdicts?: AssesseeChannelVerdicts | null;
}): Ak05RollupRow {
  const assesseeName =
    params.assessee.certificateNameConfirmed || params.assessee.displayName;
  const resolved = resolveAssesseeOverallDecision({
    unitDecisions: params.unitDecisions,
    totalSchemeUnits: params.totalSchemeUnits,
    manualOverride: params.manualOverride,
    channelVerdicts: params.channelVerdicts,
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
