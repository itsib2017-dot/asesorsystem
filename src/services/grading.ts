import { writtenGradingSchema } from "@/ai/schemas";
import {
  buildWrittenGradingPrompt,
  WRITTEN_GRADING_PROMPT_META,
} from "@/ai/prompts/written-test-grading.v1";
import { generateStructured, type RuntimeLlmConfig } from "@/ai/llm";
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

  const prompt = buildWrittenGradingPrompt({
    pseudonym: params.pseudonym,
    schemeName: params.schemeName,
    units: params.units,
    masterKeyText: params.masterKeyText,
    studentAnswerText: params.studentAnswerText,
  });

  const aiResult = await generateStructured({
    config: params.llmConfig,
    schema: writtenGradingSchema,
    prompt,
    deterministic: true,
    correlationId: params.correlationId,
  });

  if (!aiResult.ok) {
    return {
      ok: false as const,
      code: "UNPROCESSABLE" as const,
      error: aiResult.error,
    };
  }

  return {
    ok: true as const,
    promptVersion: WRITTEN_GRADING_PROMPT_META.version,
    output: aiResult.output,
  };
}
