import {
  extractOfficial04bAssessment,
  hasSavedOfficial04bAssessment,
} from "@/lib/forms/assessee-forms";
import { readArrayField, readField, readStringField } from "@/lib/utils/record-fields";

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
  const writtenRecs = readArrayField(
    params.writtenGrading,
    "vatmUnitRecommendations",
    "vatm_unit_recommendations",
  );
  const interviewRecs = readArrayField(
    params.interviewAssessment,
    "vatmUnitRecommendations",
    "vatm_unit_recommendations",
  );

  const ditCoverage = readArrayField(
    params.ditAnalysis,
    "coverageMatrix",
    "coverage_matrix",
  );
  const savedOfficial04b = extractOfficial04bAssessment(params.ditAnalysis);
  const hasSaved04b = hasSavedOfficial04bAssessment(savedOfficial04b);
  const interviewOverall = readField<"K" | "BK">(
    params.interviewAssessment,
    "overallRecommendation",
    "overall_recommendation",
  );

  // Build deduplicated unit catalog from scheme manifest + any explicit channel outputs
  const unitMap = new Map<string, SchemeUnitRef>();
  for (const u of params.units) {
    if (u.code.trim()) unitMap.set(normalizeUnitKey(u.code), u);
  }
  for (const r of [...writtenRecs, ...interviewRecs]) {
    const code = readStringField(r, "unitCode", "unit_code");
    const title = readStringField(r, "unitTitle", "unit_title");
    if (code && !unitMap.has(normalizeUnitKey(code))) {
      unitMap.set(normalizeUnitKey(code), { code, title: title || code });
    }
  }

  const catalog = Array.from(unitMap.values());
  return catalog.map((unit) => {
    const codeKey = normalizeUnitKey(unit.code);
    const titleKey = normalizeUnitKey(unit.title);

    const wMatch = writtenRecs.find((r) => {
      const rc = normalizeUnitKey(readStringField(r, "unitCode", "unit_code"));
      const rt = normalizeUnitKey(readStringField(r, "unitTitle", "unit_title"));
      return (rc && rc === codeKey) || (rt && rt === titleKey);
    });

    const iMatch = interviewRecs.find((r) => {
      const rc = normalizeUnitKey(readStringField(r, "unitCode", "unit_code"));
      const rt = normalizeUnitKey(readStringField(r, "unitTitle", "unit_title"));
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
      const saved04bItem = hasSaved04b
        ? savedOfficial04b.items.find(
            (item) =>
              codeKey &&
              item.unitCode.trim().toLowerCase() === codeKey,
          )
        : undefined;

      if (saved04bItem && saved04bItem.achieved !== null) {
        const rec: "K" | "BK" = saved04bItem.achieved ? "K" : "BK";
        channelVerdicts.push(rec);
        reasons.push(`[FR.IA.04B Asesor: ${rec}] Keputusan asesor pada aspek unit ini.`);
      } else {
        const matchedDit = ditCoverage.find((row) => {
          const kp = normalizeUnitKey(String(row.kelompokPekerjaan ?? row.kelompok_pekerjaan ?? ""));
          const fp = normalizeUnitKey(String(row.focusPoint ?? row.focus_point ?? ""));
          return (
            (codeKey && (fp.includes(codeKey) || kp.includes(codeKey))) ||
            (titleKey && kp.includes(titleKey.slice(0, 16))) ||
            (titleKey && fp.includes(titleKey.slice(0, 16)))
          );
        });
        if (matchedDit) {
          const status = String(matchedDit.status ?? "");
          if (status === "Terpenuhi") {
            channelVerdicts.push("K");
            reasons.push("[DIT 04A/04B: K] Status fokus: Terpenuhi.");
          } else if (status === "Belum Dibahas") {
            channelVerdicts.push("BK");
            reasons.push("[DIT 04A/04B: BK] Status fokus: Belum Dibahas.");
          } else if (status === "Sebagian") {
            reasons.push("[DIT 04A/04B: Sebagian] Bukti parsial — perlu penilaian asesor.");
          }
        } else {
          reasons.push("[DIT 04A/04B: Netral] Belum ada cakupan bukti DIT untuk unit ini.");
        }
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
