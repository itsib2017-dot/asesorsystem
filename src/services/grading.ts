import type { z } from "zod";
import { writtenGradingSchema } from "@/ai/schemas";
import {
  buildWrittenGradingChunkPrompt,
  buildWrittenGradingRollupPrompt,
  WRITTEN_GRADING_PROMPT_META_V2,
} from "@/ai/prompts/written-test-grading.v2";
import {
  writtenGradingItemChunkSchema,
  writtenGradingRollupSchema,
  type WrittenGradingItemVerdict,
} from "@/ai/written-grading-schemas";
import { generateStructured, type RuntimeLlmConfig } from "@/ai/llm";

type WrittenGradingOutput = z.infer<typeof writtenGradingSchema>;
import { validateMasterKey06bContent } from "@/lib/written/master-key";

export interface FormSuffixConfig {
  soal: string;
  kunci: string;
  jawaban: string;
}

/**
 * Resolves which file holds the master key vs student answer based on configurable
 * per-LSP / per-scheme mapping (Rule 6: never hardcode "06B = key").
 */
export function resolveWrittenTestFiles(
  filesBySuffix: Record<string, string>,
  mapping: FormSuffixConfig,
): { soalText: string; kunciText: string; jawabanText: string } {
  return {
    soalText: filesBySuffix[mapping.soal] ?? "",
    kunciText: filesBySuffix[mapping.kunci] ?? "",
    jawabanText: filesBySuffix[mapping.jawaban] ?? "",
  };
}

export async function runWrittenGradingPipeline(params: {
  pseudonym: string;
  schemeName: string;
  units: Array<{ code: string; title: string }>;
  masterKeyText: string;
  studentAnswerText: string;
  llmConfig: RuntimeLlmConfig;
  correlationId?: string;
  /** Number of questions in the key; defaults to unit count (fallback 13). */
  questionCount?: number;
  /** Progress callback (1..99) for live job status updates. */
  onProgress?: (progress: number) => Promise<void> | void;
  /** Injected for tests; defaults to the real LLM wrapper. */
  generate?: typeof generateStructured;
}) {
  if (!params.masterKeyText.trim() || !params.studentAnswerText.trim()) {
    return {
      ok: false as const,
      code: "UNPROCESSABLE" as const,
      error: "Kunci jawaban atau lembar jawaban asesi masih kosong.",
    };
  }

  const keyValidation = validateMasterKey06bContent(params.masterKeyText);
  if (!keyValidation.valid) {
    return {
      ok: false as const,
      code: "UNPROCESSABLE" as const,
      error: `Kunci jawaban 06B ditolak: ${keyValidation.summary}`,
    };
  }

  const generate = params.generate ?? generateStructured;
  const questionCount = Math.max(1, params.questionCount ?? (params.units.length || 13));
  const ranges = buildQuestionRanges(questionCount, GRADING_CHUNK_SIZE);

  await params.onProgress?.(15);

  let completedChunks = 0;
  // Round 22 P0-1: small parallel item chunks instead of one 13-item structured output.
  const chunkResults = await Promise.all(
    ranges.map(async (range) => {
      const res = await generate({
        config: params.llmConfig,
        schema: writtenGradingItemChunkSchema,
        prompt: buildWrittenGradingChunkPrompt({
          pseudonym: params.pseudonym,
          schemeName: params.schemeName,
          masterKeyText: params.masterKeyText,
          studentAnswerText: params.studentAnswerText,
          fromQuestion: range.from,
          toQuestion: range.to,
        }),
        deterministic: true,
        correlationId: params.correlationId
          ? `${params.correlationId}:q${range.from}-${range.to}`
          : undefined,
        timeoutMs: CHUNK_ATTEMPT_TIMEOUT_MS,
        totalBudgetMs: CHUNK_TOTAL_BUDGET_MS,
      });
      completedChunks++;
      const pct = 15 + Math.round((completedChunks / Math.max(1, ranges.length)) * 55);
      await params.onProgress?.(pct);
      return res;
    }),
  );

  const failures = chunkResults
    .map((r, i) => ({ r, range: ranges[i]! }))
    .filter((x) => !x.r.ok);
  if (failures.length > 0) {
    // Never persist partial grading: all-or-nothing, with a per-range reason.
    return {
      ok: false as const,
      code: "UNPROCESSABLE" as const,
      error: failures
        .map((f) => `Soal ${f.range.from}–${f.range.to}: ${f.r.ok ? "" : f.r.error}`)
        .join(" | "),
    };
  }

  // Enforce strict per-chunk range filtering so a stray item in chunk A never shadows chunk B.
  const verdictsByNo = new Map<number, WrittenGradingItemVerdict>();
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]!;
    const res = chunkResults[i]!;
    if (!res.ok) continue;
    const scoped = filterVerdictsToRange(res.output.itemVerdicts, range.from, range.to);
    for (const v of scoped) {
      if (!verdictsByNo.has(v.questionNo)) {
        verdictsByNo.set(v.questionNo, v);
      }
    }
  }

  const missingNumbers: number[] = [];
  for (let n = 1; n <= questionCount; n++) {
    if (!verdictsByNo.has(n)) {
      missingNumbers.push(n);
    }
  }

  if (missingNumbers.length > 0) {
    await params.onProgress?.(75);
    const recoveryGroups: number[][] = [];
    for (let i = 0; i < missingNumbers.length; i += GRADING_CHUNK_SIZE) {
      recoveryGroups.push(missingNumbers.slice(i, i + GRADING_CHUNK_SIZE));
    }
    const recoveryResults = await Promise.all(
      recoveryGroups.map((group) =>
        generate({
          config: params.llmConfig,
          schema: writtenGradingItemChunkSchema,
          prompt: buildWrittenGradingChunkPrompt({
            pseudonym: params.pseudonym,
            schemeName: params.schemeName,
            masterKeyText: params.masterKeyText,
            studentAnswerText: params.studentAnswerText,
            fromQuestion: Math.min(...group),
            toQuestion: Math.max(...group),
            targetQuestionNumbers: group,
          }),
          deterministic: true,
          correlationId: params.correlationId
            ? `${params.correlationId}:recover-${group.join(",")}`
            : undefined,
          timeoutMs: 60_000,
          totalBudgetMs: 65_000,
        }),
      ),
    );
    for (let i = 0; i < recoveryGroups.length; i++) {
      const group = recoveryGroups[i]!;
      const recRes = recoveryResults[i]!;
      if (!recRes.ok) continue;
      const allowed = new Set(group);
      const scoped = filterVerdictsToRange(
        recRes.output.itemVerdicts,
        Math.min(...group),
        Math.max(...group),
        allowed,
      );
      for (const v of scoped) {
        if (!verdictsByNo.has(v.questionNo)) {
          verdictsByNo.set(v.questionNo, v);
        }
      }
    }
    await params.onProgress?.(80);
  }

  const itemVerdicts = [...verdictsByNo.values()].sort(
    (a, b) => a.questionNo - b.questionNo,
  );
  if (itemVerdicts.length === 0) {
    return {
      ok: false as const,
      code: "UNPROCESSABLE" as const,
      error: "Structured output validation failed: model tidak menghasilkan vonis soal apa pun.",
    };
  }

  await params.onProgress?.(85);

  const rollup = await generate({
    config: params.llmConfig,
    schema: writtenGradingRollupSchema,
    prompt: buildWrittenGradingRollupPrompt({
      pseudonym: params.pseudonym,
      schemeName: params.schemeName,
      units: params.units,
      verdicts: itemVerdicts,
      studentAnswerText: params.studentAnswerText,
    }),
    deterministic: true,
    correlationId: params.correlationId ? `${params.correlationId}:rollup` : undefined,
    timeoutMs: ROLLUP_ATTEMPT_TIMEOUT_MS,
    totalBudgetMs: ROLLUP_TOTAL_BUDGET_MS,
  });
  if (!rollup.ok) {
    return {
      ok: false as const,
      code: "UNPROCESSABLE" as const,
      error: `Roll-up VATM/plagiarisme: ${rollup.error}`,
    };
  }

  await params.onProgress?.(95);

  const output: WrittenGradingOutput = {
    pseudonym: params.pseudonym,
    itemVerdicts,
    ringkasanKesalahan: itemVerdicts
      .filter((v) => v.verdict !== "Benar")
      .map((v) => v.questionNo),
    vatmUnitRecommendations: rollup.output.vatmUnitRecommendations,
    plagiarismReport: rollup.output.plagiarismReport,
  };

  return {
    ok: true as const,
    promptVersion: WRITTEN_GRADING_PROMPT_META_V2.version as string,
    output: writtenGradingSchema.parse(output),
  };
}

/** Items per structured call. Small enough for reasoning models to finish. */
export const GRADING_CHUNK_SIZE = 4;
// Chunks run in parallel, then one rollup: 150s + 85s stays under the 240s job budget.
const CHUNK_ATTEMPT_TIMEOUT_MS = 140_000;
const CHUNK_TOTAL_BUDGET_MS = 150_000;
const ROLLUP_ATTEMPT_TIMEOUT_MS = 80_000;
const ROLLUP_TOTAL_BUDGET_MS = 85_000;

export function buildQuestionRanges(
  total: number,
  size: number,
): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  for (let from = 1; from <= total; from += size) {
    ranges.push({ from, to: Math.min(total, from + size - 1) });
  }
  return ranges;
}

/** Filters verdicts to a single chunk range [from, to] (and optional explicit set), deduped & sorted. */
export function filterVerdictsToRange(
  verdicts: WrittenGradingItemVerdict[],
  from: number,
  to: number,
  allowedNumbers?: ReadonlySet<number>,
): WrittenGradingItemVerdict[] {
  const byNo = new Map<number, WrittenGradingItemVerdict>();
  for (const v of verdicts) {
    if (!Number.isInteger(v.questionNo)) continue;
    if (v.questionNo < from || v.questionNo > to) continue;
    if (allowedNumbers && !allowedNumbers.has(v.questionNo)) continue;
    if (!byNo.has(v.questionNo)) {
      byNo.set(v.questionNo, v);
    }
  }
  return [...byNo.values()].sort((a, b) => a.questionNo - b.questionNo);
}

/** Dedupe by questionNo (first wins), drop out-of-range numbers, sort ascending. */
export function mergeItemVerdicts(
  verdicts: WrittenGradingItemVerdict[],
  questionCount: number,
): WrittenGradingItemVerdict[] {
  return filterVerdictsToRange(verdicts, 1, questionCount);
}
