import type { AssesseeRecord } from "@/repositories/assessees.repository";
import {
  listBatchDecisionOverrides,
  listDecisionsForBatch,
} from "@/repositories/assessment.repository";
import {
  computeAk05RowForAssessee,
  resolveAssesseeOverallDecision,
  type Ak05RollupRow,
  type OverallDecisionOverrideLike,
  type ResolvedOverallDecision,
  type UnitDecisionLike,
} from "./decision-rules";

export {
  computeAk05RowForAssessee,
  resolveAssesseeOverallDecision,
  type Ak05RollupRow,
  type OverallDecisionOverrideLike,
  type ResolvedOverallDecision,
  type UnitDecisionLike,
};

export async function resolveAk05BatchRows(
  userId: string,
  batchId: string,
  assessees: AssesseeRecord[],
  options?: { totalSchemeUnits?: number | null },
): Promise<Ak05RollupRow[]> {
  if (assessees.length === 0) return [];
  const [batchDecisions, batchOverrides] = await Promise.all([
    listDecisionsForBatch(userId, batchId) as unknown as Promise<UnitDecisionLike[]>,
    listBatchDecisionOverrides(userId, batchId),
  ]);

  const byAssessee = new Map<string, UnitDecisionLike[]>();
  for (const d of batchDecisions) {
    const aid = String(d.assesseeId ?? d.assessee_id ?? "");
    if (!aid) continue;
    const list = byAssessee.get(aid) ?? [];
    list.push(d);
    byAssessee.set(aid, list);
  }

  const overridesByAssessee = new Map(
    batchOverrides.map((o) => [o.assesseeId, o]),
  );

  return assessees.map((a, idx) =>
    computeAk05RowForAssessee({
      no: idx + 1,
      assessee: a,
      unitDecisions: byAssessee.get(a.id) ?? [],
      totalSchemeUnits: options?.totalSchemeUnits,
      manualOverride: overridesByAssessee.get(a.id) ?? null,
    }),
  );
}
