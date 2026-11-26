import { buildInterviewQuestionsSchema } from "@/ai/schemas";
import {
  buildInterviewPrompt,
  INTERVIEW_DIMENSIONS,
  INTERVIEW_PROMPT_META,
  type InterviewPromptInput,
} from "@/ai/prompts/interview-rctfa.v1";
import { generateStructured, type RuntimeLlmConfig } from "@/ai/llm";

export type InterviewDimension = (typeof INTERVIEW_DIMENSIONS)[number];

export interface GeneratedInterviewQuestion {
  no: number;
  unitCode: string;
  dimension: InterviewDimension;
  question: string;
}

const HAS_EXPLICIT_STAR_RE =
  /\(?\bSituation\b\)?[\s\S]*\(?\bTask\b\)?[\s\S]*\(?\bAction\b\)?[\s\S]*\(?\bResult\b\)?/i;

/**
 * Deterministic post-processor (P1-1, P1-2, P1-3):
 * 1. Orders questions by scheme `units` sequence and assigns strict `1..N` numbers.
 * 2. Guarantees all 5 RCTFA dimensions (`TS`, `TMS`, `CMS`, `JRES`, `TrS`) appear when `questionCount >= 5`.
 * 3. Ensures explicit STAR cue labels exist on every question.
 */
export function normalizeInterviewQuestions(
  rawQuestions: GeneratedInterviewQuestion[],
  units: Array<{ code?: string; title: string }>,
  questionCount: number,
): GeneratedInterviewQuestion[] {
  const unitIndex = new Map<string, number>();
  units.forEach((u, idx) => {
    const code = (u.code ?? "").trim().toLowerCase();
    if (code && !unitIndex.has(code)) unitIndex.set(code, idx);
  });

  const sorted = rawQuestions
    .map((q, origIdx) => ({
      q,
      origIdx,
      uIdx: unitIndex.get((q.unitCode ?? "").trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.uIdx - b.uIdx || a.origIdx - b.origIdx)
    .map((entry, idx) => {
      const text = entry.q.question.trim();
      const withStar = HAS_EXPLICIT_STAR_RE.test(text)
        ? text
        : `(Situation/Task/Action/Result) ${text}`;
      return {
        ...entry.q,
        no: idx + 1,
        question: withStar,
      };
    });

  if (questionCount >= INTERVIEW_DIMENSIONS.length && sorted.length >= INTERVIEW_DIMENSIONS.length) {
    const counts = new Map<InterviewDimension, number>(
      INTERVIEW_DIMENSIONS.map((d) => [d, 0]),
    );
    for (const q of sorted) {
      counts.set(q.dimension, (counts.get(q.dimension) ?? 0) + 1);
    }

    for (const missingDim of INTERVIEW_DIMENSIONS) {
      if ((counts.get(missingDim) ?? 0) > 0) continue;
      let donorDim: InterviewDimension | null = null;
      let donorCount = 1;
      for (const dim of INTERVIEW_DIMENSIONS) {
        const c = counts.get(dim) ?? 0;
        if (c > donorCount) {
          donorCount = c;
          donorDim = dim;
        }
      }
      if (!donorDim) break;
      const donorIdx = sorted.findLastIndex((q) => q.dimension === donorDim);
      if (donorIdx >= 0) {
        sorted[donorIdx]!.dimension = missingDim;
        counts.set(donorDim, donorCount - 1);
        counts.set(missingDim, 1);
      }
    }
  }

  return sorted;
}

export async function runInterviewPipeline(
  params: InterviewPromptInput & {
    llmConfig: RuntimeLlmConfig;
    correlationId?: string;
  },
) {
  const schema = buildInterviewQuestionsSchema(params.questionCount);
  const prompt = buildInterviewPrompt(params);

  const aiResult = await generateStructured({
    config: params.llmConfig,
    schema,
    prompt,
    deterministic: true,
    correlationId: params.correlationId,
  });

  if (!aiResult.ok) {
    return {
      ok: false as const,
      reason: aiResult.status,
      error: aiResult.error,
    };
  }

  return {
    ok: true as const,
    promptVersion: INTERVIEW_PROMPT_META.version,
    output: {
      ...aiResult.output,
      interviewQuestions: normalizeInterviewQuestions(
        aiResult.output.interviewQuestions,
        params.units,
        params.questionCount,
      ),
    },
  };
}
