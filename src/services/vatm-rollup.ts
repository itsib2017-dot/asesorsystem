export interface SchemeUnitRef {
  code: string;
  title: string;
}

export interface VatmUnitRollupItem {
  unitCode: string;
  unitTitle: string;
  aiRecommendation: "K" | "BK" | null;
  vatmReasoning: string;
}

function normalizeUnitKey(value: string): string {
  return value.trim().toLowerCase();
}

function getArrayField(
  row: Record<string, unknown> | null | undefined,
  camel: string,
  snake: string,
): Array<Record<string, unknown>> {
  if (!row) return [];
  const val = row[camel] ?? row[snake];
  return Array.isArray(val) ? (val as Array<Record<string, unknown>>) : [];
}

/**
 * Aggregates binary VATM recommendations per competency unit across all three
 * assessment evidence channels: DIT (04A/04B), Written Test (06B/06C), and
 * Interview (FR.IA.09). Follows D15/D16: binary K/BK only; any BK evidence
 * across channels sets the rolled-up recommendation to BK for assessor review.
 */
export function computeVatmUnitRollup(params: {
  units: SchemeUnitRef[];
  ditAnalysis?: Record<string, unknown> | null;
  writtenGrading?: Record<string, unknown> | null;
  interviewAssessment?: Record<string, unknown> | null;
}): VatmUnitRollupItem[] {
  const writtenRecs = getArrayField(
    params.writtenGrading,
    "vatmUnitRecommendations",
    "vatm_unit_recommendations",
  );
  const interviewRecs = getArrayField(
    params.interviewAssessment,
    "vatmUnitRecommendations",
    "vatm_unit_recommendations",
  );

  const ditCoverage = getArrayField(
    params.ditAnalysis,
    "coverageMatrix",
    "coverage_matrix",
  );
  const ditReadiness =
    (params.ditAnalysis?.readiness as { recommendation?: string } | undefined) ?? undefined;
  const interviewOverall =
    (params.interviewAssessment?.overallRecommendation ??
      params.interviewAssessment?.overall_recommendation) as "K" | "BK" | undefined;

  // Build deduplicated unit catalog from scheme manifest + any explicit channel outputs
  const unitMap = new Map<string, SchemeUnitRef>();
  for (const u of params.units) {
    if (u.code.trim()) unitMap.set(normalizeUnitKey(u.code), u);
  }
  for (const r of [...writtenRecs, ...interviewRecs]) {
    const code = String(r.unitCode ?? r.unit_code ?? "").trim();
    const title = String(r.unitTitle ?? r.unit_title ?? "").trim();
    if (code && !unitMap.has(normalizeUnitKey(code))) {
      unitMap.set(normalizeUnitKey(code), { code, title: title || code });
    }
  }

  const catalog = Array.from(unitMap.values());
  return catalog.map((unit) => {
    const codeKey = normalizeUnitKey(unit.code);
    const titleKey = normalizeUnitKey(unit.title);

    const wMatch = writtenRecs.find((r) => {
      const rc = normalizeUnitKey(String(r.unitCode ?? r.unit_code ?? ""));
      const rt = normalizeUnitKey(String(r.unitTitle ?? r.unit_title ?? ""));
      return (rc && rc === codeKey) || (rt && rt === titleKey);
    });

    const iMatch = interviewRecs.find((r) => {
      const rc = normalizeUnitKey(String(r.unitCode ?? r.unit_code ?? ""));
      const rt = normalizeUnitKey(String(r.unitTitle ?? r.unit_title ?? ""));
      return (rc && rc === codeKey) || (rt && rt === titleKey);
    });

    const channelVerdicts: Array<"K" | "BK"> = [];
    const reasons: string[] = [];

    if (wMatch) {
      const rec = wMatch.recommendation === "BK" ? "BK" : "K";
      channelVerdicts.push(rec);
      const reason = String(wMatch.reasoning ?? "").trim();
      reasons.push(`[Tertulis 06C: ${rec}]${reason ? ` ${reason}` : ""}`);
    }

    if (iMatch) {
      const rec = iMatch.recommendation === "BK" ? "BK" : "K";
      channelVerdicts.push(rec);
      const reason = String(iMatch.reasoning ?? "").trim();
      reasons.push(`[Wawancara IA.09: ${rec}]${reason ? ` ${reason}` : ""}`);
    } else if (interviewOverall === "K" || interviewOverall === "BK") {
      channelVerdicts.push(interviewOverall);
      reasons.push(
        `[Wawancara IA.09: ${interviewOverall}] Hasil keseluruhan wawancara asesor.`,
      );
    }

    if (params.ditAnalysis) {
      const matchedDit = ditCoverage.find((row) => {
        const kp = normalizeUnitKey(String(row.kelompokPekerjaan ?? ""));
        const fp = normalizeUnitKey(String(row.focusPoint ?? ""));
        return (titleKey && kp.includes(titleKey.slice(0, 16))) || (titleKey && fp.includes(titleKey.slice(0, 16)));
      });
      if (matchedDit) {
        const status = String(matchedDit.status ?? "");
        const rec: "K" | "BK" = status === "Terpenuhi" ? "K" : "BK";
        channelVerdicts.push(rec);
        reasons.push(`[DIT 04A/04B: ${rec}] Status fokus: ${status}.`);
      } else if (ditReadiness?.recommendation) {
        const rec: "K" | "BK" =
          ditReadiness.recommendation === "Kompeten" ? "K" : "BK";
        channelVerdicts.push(rec);
        reasons.push(`[DIT 04A/04B: ${rec}] Kesiapan DIT: ${ditReadiness.recommendation}.`);
      }
    }

    const aiRecommendation: "K" | "BK" | null =
      channelVerdicts.length === 0
        ? null
        : channelVerdicts.includes("BK")
          ? "BK"
          : "K";

    return {
      unitCode: unit.code,
      unitTitle: unit.title,
      aiRecommendation,
      vatmReasoning:
        reasons.join(" | ") ||
        "Belum ada rekomendasi AI/wawancara — menunggu penilaian kanal bukti.",
    };
  });
}
