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

  // Round 22 P0-1: small parallel item chunks instead of one 13-item structured output.
  const chunkResults = await Promise.all(
    ranges.map((range) =>
      generate({
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
      }),
    ),
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

  const itemVerdicts = mergeItemVerdicts(
    chunkResults.flatMap((r) => (r.ok ? r.output.itemVerdicts : [])),
    questionCount,
  );
  if (itemVerdicts.length === 0) {
    return {
      ok: false as const,
      code: "UNPROCESSABLE" as const,
      error: "Structured output validation failed: model tidak menghasilkan vonis soal apa pun.",
    };
  }

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

/** Dedupe by questionNo (first wins), drop out-of-range numbers, sort ascending. */
export function mergeItemVerdicts(
  verdicts: WrittenGradingItemVerdict[],
  questionCount: number,
): WrittenGradingItemVerdict[] {
  const byNo = new Map<number, WrittenGradingItemVerdict>();
  for (const v of verdicts) {
    if (v.questionNo < 1 || v.questionNo > questionCount) continue;
    if (!byNo.has(v.questionNo)) byNo.set(v.questionNo, v);
  }
  return [...byNo.values()].sort((a, b) => a.questionNo - b.questionNo);
}
