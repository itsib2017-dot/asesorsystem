import type { AssesseeRecord } from "@/repositories/assessees.repository";
import {
  listBatchDecisionOverrides,
  listDecisionsForBatch,
  listDitAnalysesForBatch,
  listInterviewAssessmentsForBatch,
  listWrittenGradingsForBatch,
} from "@/repositories/assessment.repository";
import {
  computeAk05RowForAssessee,
  deriveOfficialChannelVerdicts,
  resolveAssesseeOverallDecision,
  type Ak05RollupRow,
  type AssesseeChannelVerdicts,
  type ChannelVerdictSummary,
  type OverallDecisionOverrideLike,
  type ResolvedOverallDecision,
  type UnitDecisionLike,
} from "./decision-rules";

export {
  computeAk05RowForAssessee,
  deriveOfficialChannelVerdicts,
  resolveAssesseeOverallDecision,
  type Ak05RollupRow,
  type AssesseeChannelVerdicts,
  type ChannelVerdictSummary,
  type OverallDecisionOverrideLike,
  type ResolvedOverallDecision,
  type UnitDecisionLike,
};

function indexLatestByAssessee(
  rows: Array<Record<string, unknown>>,
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const aid = String(row.assesseeId ?? row.assessee_id ?? "");
    if (!aid || map.has(aid)) continue;
    map.set(aid, row);
  }
  return map;
}

export async function resolveAk05BatchRows(
  userId: string,
  batchId: string,
  assessees: AssesseeRecord[],
  options?: { totalSchemeUnits?: number | null },
): Promise<Ak05RollupRow[]> {
  if (assessees.length === 0) return [];
  const [
    batchDecisions,
    batchOverrides,
    batchDits,
    batchWrittens,
    batchInterviews,
  ] = await Promise.all([
    listDecisionsForBatch(userId, batchId) as unknown as Promise<UnitDecisionLike[]>,
    listBatchDecisionOverrides(userId, batchId),
    listDitAnalysesForBatch(userId, batchId) as unknown as Promise<
      Array<Record<string, unknown>>
    >,
    listWrittenGradingsForBatch(userId, batchId) as unknown as Promise<
      Array<Record<string, unknown>>
    >,
    listInterviewAssessmentsForBatch(userId, batchId) as unknown as Promise<
      Array<Record<string, unknown>>
    >,
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
  const latestDitByAssessee = indexLatestByAssessee(batchDits);
  const latestWrittenByAssessee = indexLatestByAssessee(batchWrittens);
  const latestInterviewByAssessee = indexLatestByAssessee(batchInterviews);

  return assessees.map((a, idx) =>
    computeAk05RowForAssessee({
      no: idx + 1,
      assessee: a,
      unitDecisions: byAssessee.get(a.id) ?? [],
      totalSchemeUnits: options?.totalSchemeUnits,
      manualOverride: overridesByAssessee.get(a.id) ?? null,
      channelVerdicts: deriveOfficialChannelVerdicts({
        ditAnalysis: latestDitByAssessee.get(a.id) ?? null,
        writtenGrading: latestWrittenByAssessee.get(a.id) ?? null,
        interviewAssessment: latestInterviewByAssessee.get(a.id) ?? null,
      }),
    }),
  );
}
