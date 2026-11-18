import type { AssesseeRecord } from "@/repositories/assessees.repository";
import { listDecisionsForBatch } from "@/repositories/assessment.repository";

export interface Ak05RollupRow {
  no: number;
  assesseeId: string;
  assesseeName: string;
  recommendation: "K" | "BK" | "-";
  keterangan: string;
  undecided: boolean;
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

/**
 * Computes binary K / BK / undecided ("-") FR.AK.05 recommendation for one assessee
 * from their per-unit competency decisions (D16). Never fabricates "K" before any
 * unit decision has been recorded.
 */
export function computeAk05RowForAssessee(params: {
  no: number;
  assessee: Pick<AssesseeRecord, "id" | "displayName" | "certificateNameConfirmed">;
  unitDecisions: UnitDecisionLike[];
}): Ak05RollupRow {
  const assesseeName =
    params.assessee.certificateNameConfirmed || params.assessee.displayName;
  const decided = params.unitDecisions.filter(
    (d) => d.decision === "K" || d.decision === "BK",
  );

  if (decided.length === 0) {
    return {
      no: params.no,
      assesseeId: params.assessee.id,
      assesseeName,
      recommendation: "-",
      keterangan: "Belum diputuskan",
      undecided: true,
    };
  }

  const bkUnits = decided.filter((d) => d.decision === "BK");
  if (bkUnits.length > 0) {
    const keterangan = bkUnits
      .map((u) => {
        const code = (u.unitCode ?? u.unit_code ?? "").trim();
        const title = (u.unitTitle ?? u.unit_title ?? "").trim();
        if (code && title) return `${code} (${title})`;
        return code || title;
      })
      .filter(Boolean)
      .join("; ");

    return {
      no: params.no,
      assesseeId: params.assessee.id,
      assesseeName,
      recommendation: "BK",
      keterangan: keterangan || "Unit belum kompeten",
      undecided: false,
    };
  }

  return {
    no: params.no,
    assesseeId: params.assessee.id,
    assesseeName,
    recommendation: "K",
    keterangan: "",
    undecided: false,
  };
}

export async function resolveAk05BatchRows(
  userId: string,
  batchId: string,
  assessees: AssesseeRecord[],
): Promise<Ak05RollupRow[]> {
  if (assessees.length === 0) return [];
  const batchDecisions = (await listDecisionsForBatch(
    userId,
    batchId,
  )) as unknown as UnitDecisionLike[];

  const byAssessee = new Map<string, UnitDecisionLike[]>();
  for (const d of batchDecisions) {
    const aid = String(d.assesseeId ?? d.assessee_id ?? "");
    if (!aid) continue;
    const list = byAssessee.get(aid) ?? [];
    list.push(d);
    byAssessee.set(aid, list);
  }

  return assessees.map((a, idx) =>
    computeAk05RowForAssessee({
      no: idx + 1,
      assessee: a,
      unitDecisions: byAssessee.get(a.id) ?? [],
    }),
  );
}
