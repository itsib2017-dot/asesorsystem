import { getConfigWithSource } from "@/lib/config/get-config";
import { getBatchById } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import {
  listSimilarityPairsByBatch,
  listWrittenGradingsForBatch,
} from "@/repositories/assessment.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import {
  DEFAULT_SIMILARITY_THRESHOLDS,
  renderCombinedWrittenReportMarkdown,
} from "@/services/similarity";

interface RawItemVerdict {
  questionNo?: unknown;
  verdict?: unknown;
  explanation?: unknown;
}

export async function loadBatchSimilarityReportData(userId: string, batchId: string) {
  const batch = await getBatchById(userId, batchId);
  if (!batch) return null;

  const [pairs, assessees, schemes, thresholdConfig, gradings] = await Promise.all([
    listSimilarityPairsByBatch(userId, batchId),
    listAssesseesByBatch(userId, batchId),
    listSchemes(userId, batch.lspId),
    getConfigWithSource("similarity.flag_thresholds", {
      lspId: batch.lspId,
      schemeId: batch.schemeId ?? undefined,
    }),
    listWrittenGradingsForBatch(userId, batchId),
  ]);

  const rawTh = thresholdConfig.value as
    | { exact?: number; near?: number; partial?: number; unconfirmed?: boolean }
    | null;
  const thresholds = {
    exact: Number(rawTh?.exact ?? DEFAULT_SIMILARITY_THRESHOLDS.exact),
    near: Number(rawTh?.near ?? DEFAULT_SIMILARITY_THRESHOLDS.near),
    partial: Number(rawTh?.partial ?? DEFAULT_SIMILARITY_THRESHOLDS.partial),
  };
  const thresholdsUncalibrated = rawTh ? rawTh.unconfirmed !== false : true;
  const thresholdSource = thresholdConfig.source;
  const thresholdSourceLabel = thresholdConfig.sourceLabel;

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

  // gradings are ordered by createdAt DESC, so keep first row seen per assesseeId
  const latestGradingByAssessee = new Map<string, Record<string, unknown>>();
  for (const row of gradings as Array<Record<string, unknown>>) {
    const aid = String(row.assesseeId ?? row.assessee_id ?? "");
    if (aid && !latestGradingByAssessee.has(aid)) {
      latestGradingByAssessee.set(aid, row);
    }
  }

  const assesseeSummaries = assessees.map((a) => {
    const grading = latestGradingByAssessee.get(a.id);
    const rawVerdicts = grading?.itemVerdicts ?? grading?.item_verdicts;
    const verdicts = Array.isArray(rawVerdicts)
      ? (rawVerdicts as RawItemVerdict[]).map((v, i) => ({
          questionNo: Number(v.questionNo ?? i + 1),
          verdict: String(v.verdict ?? "-"),
          explanation: String(v.explanation ?? "-"),
        }))
      : [];

    const rawErr = grading?.errorSummary ?? grading?.error_summary;
    const ringkasanKesalahan = Array.isArray(rawErr)
      ? rawErr.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [];

    const rawPlag = (grading?.plagiarismReport ?? grading?.plagiarism_report) as
      | { status?: string; reasoning?: string }
      | undefined;

    const isFlagged = flaggedIds.has(a.id);
    let plagiarismStatus: "Bersih" | "Waspada" | "Belum diperiksa";
    let plagiarismReasoning: string;

    if (isFlagged || rawPlag?.status === "Waspada") {
      plagiarismStatus = "Waspada";
      plagiarismReasoning = isFlagged
        ? "Terdapat pasangan jawaban di atas ambang batas kemiripan — mohon tinjau manual."
        : rawPlag?.reasoning?.trim() || "Terindikasi kemiripan pada koreksi tertulis — mohon tinjau manual.";
    } else if (grading && rawPlag?.status === "Bersih") {
      plagiarismStatus = "Bersih";
      plagiarismReasoning =
        rawPlag.reasoning?.trim() ||
        "Koreksi tertulis selesai tanpa indikasi kemiripan di atas ambang batas.";
    } else if (grading && flaggedPairs.length === 0 && pairs.length > 0) {
      // Wait: pairs only stores flagged pairs, so absence of rows without rawPlag="Bersih" remains neutral
      plagiarismStatus = "Belum diperiksa";
      plagiarismReasoning =
        "Koreksi tertulis tersedia, namun analisis kemiripan belum menghasilkan status terverifikasi.";
    } else {
      plagiarismStatus = "Belum diperiksa";
      plagiarismReasoning =
        "Pemeriksaan kemiripan atau koreksi tertulis belum menghasilkan kesimpulan untuk asesi ini.";
    }

    return {
      assesseeId: a.id,
      realName: a.displayName,
      verdicts,
      ringkasanKesalahan,
      plagiarismStatus,
      plagiarismReasoning,
    };
  });

  const combinedMd = renderCombinedWrittenReportMarkdown({
    batchName: batch.name,
    schemeName,
    thresholds,
    thresholdsUncalibrated,
    thresholdSourceLabel,
    assessees: assesseeSummaries,
    flaggedPairs,
  });

  return {
    batch,
    schemeName,
    thresholds,
    thresholdsUncalibrated,
    thresholdSource,
    thresholdSourceLabel,
    pairs,
    flaggedPairs,
    assesseeSummaries,
    combinedMd,
  };
}
