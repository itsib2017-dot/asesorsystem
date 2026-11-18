import { getConfig } from "@/lib/config/get-config";
import { getBatchById } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { listSimilarityPairsByBatch } from "@/repositories/assessment.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import {
  DEFAULT_SIMILARITY_THRESHOLDS,
  renderCombinedWrittenReportMarkdown,
} from "@/services/similarity";

export async function loadBatchSimilarityReportData(userId: string, batchId: string) {
  const batch = await getBatchById(userId, batchId);
  if (!batch) return null;

  const [pairs, assessees, schemes, configuredThresholds] = await Promise.all([
    listSimilarityPairsByBatch(userId, batchId),
    listAssesseesByBatch(userId, batchId),
    listSchemes(userId, batch.lspId),
    getConfig("similarity.flag_thresholds", { lspId: batch.lspId }),
  ]);

  const thresholds = configuredThresholds ?? { ...DEFAULT_SIMILARITY_THRESHOLDS };
  const scheme = schemes.find((s) => s.id === batch.schemeId);
  const schemeName = scheme
    ? `${scheme.code} — ${scheme.name}`
    : "Skema Tersertifikasi (lihat Pengaturan Skema)";

  const nameMap = new Map(assessees.map((a) => [a.id, a.displayName]));
  const flaggedPairs = pairs.map((p: Record<string, unknown>) => {
    const idA = String(p.assesseeAId ?? p.assessee_a_id ?? "");
    const idB = String(p.assesseeBId ?? p.assessee_b_id ?? "");
    return {
      assesseeAId: idA,
      assesseeAName: nameMap.get(idA) ?? idA,
      assesseeBId: idB,
      assesseeBName: nameMap.get(idB) ?? idB,
      jaccardScore: Number(p.jaccardScore ?? p.jaccard_score ?? 0),
      tfidfCosine: Number(p.tfidfCosine ?? p.tfidf_cosine ?? 0),
      sharedSpans: Array.isArray(p.sharedSpans ?? p.shared_spans)
        ? ((p.sharedSpans ?? p.shared_spans) as string[])
        : [],
      verdict: String(p.verdict ?? "perlu_ditinjau"),
    };
  });

  const flaggedIds = new Set<string>();
  for (const fp of flaggedPairs) {
    if (fp.assesseeAId) flaggedIds.add(fp.assesseeAId);
    if (fp.assesseeBId) flaggedIds.add(fp.assesseeBId);
  }

  const assesseeSummaries = assessees.map((a) => ({
    assesseeId: a.id,
    realName: a.displayName,
    verdicts: [] as Array<{ questionNo: number; verdict: string; explanation: string }>,
    ringkasanKesalahan: [] as number[],
    plagiarismStatus: flaggedIds.has(a.id) ? ("Waspada" as const) : ("Bersih" as const),
    plagiarismReasoning: flaggedIds.has(a.id)
      ? "Terdapat pasangan jawaban di atas ambang batas — mohon tinjau manual."
      : "Menunggu hasil pemeriksaan tertulis / bersih.",
  }));

  const combinedMd = renderCombinedWrittenReportMarkdown({
    batchName: batch.name,
    schemeName,
    thresholds,
    assessees: assesseeSummaries,
    flaggedPairs,
  });

  return {
    batch,
    schemeName,
    thresholds,
    pairs,
    flaggedPairs,
    assesseeSummaries,
    combinedMd,
  };
}
