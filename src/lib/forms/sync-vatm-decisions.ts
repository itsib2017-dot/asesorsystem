import {
  getLatestDitAnalysis,
  getLatestInterviewAssessment,
  getLatestWrittenGrading,
  upsertAiUnitRecommendations,
} from "@/repositories/assessment.repository";
import type { SchemeRecord } from "@/repositories/schemes.repository";
import { resolveSchemeUnitsList } from "@/lib/forms/assessee-forms";
import {
  computeVatmUnitRollup,
  type SchemeUnitRef,
  type VatmUnitRollupItem,
} from "@/services/vatm-rollup";

export function resolveUnitsForScheme(scheme?: SchemeRecord | null): SchemeUnitRef[] {
  return resolveSchemeUnitsList(scheme).map((u) => ({
    code: u.code ?? "",
    title: u.title,
  }));
}

export async function syncAssesseeVatmRecommendations(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  scheme?: SchemeRecord | null;
}): Promise<VatmUnitRollupItem[]> {
  const [ditAnalysis, writtenGrading, interviewAssessment] = await Promise.all([
    getLatestDitAnalysis(params.userId, params.assesseeId),
    getLatestWrittenGrading(params.userId, params.assesseeId),
    getLatestInterviewAssessment(params.userId, params.assesseeId),
  ]);

  const rollup = computeVatmUnitRollup({
    units: resolveUnitsForScheme(params.scheme),
    ditAnalysis: ditAnalysis as Record<string, unknown> | null,
    writtenGrading: writtenGrading as Record<string, unknown> | null,
    interviewAssessment: interviewAssessment as Record<string, unknown> | null,
  });

  await upsertAiUnitRecommendations({
    userId: params.userId,
    lspId: params.lspId,
    batchId: params.batchId,
    assesseeId: params.assesseeId,
    items: rollup,
  });

  return rollup;
}
