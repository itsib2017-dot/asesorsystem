import { buildInterviewQuestionsSchema } from "@/ai/schemas";
import {
  buildInterviewPrompt,
  INTERVIEW_PROMPT_META,
  type InterviewPromptInput,
} from "@/ai/prompts/interview-rctfa.v1";
import { generateStructured, type RuntimeLlmConfig } from "@/ai/llm";

export async function runInterviewPipeline(params: InterviewPromptInput & {
  llmConfig: RuntimeLlmConfig;
  correlationId?: string;
}) {
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
    output: aiResult.output,
  };
}
