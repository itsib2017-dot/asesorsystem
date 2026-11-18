import { generateText, Output } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { z } from "zod";
import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import { logEvent } from "@/lib/logger";

export interface RuntimeLlmConfig {
  provider: "anthropic" | "openai-compatible" | "gemini";
  apiKey: string;
  baseUrl?: string | null;
  gatewayToken?: string | null;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

function resolveModel(cfg: RuntimeLlmConfig) {
  if (cfg.baseUrl) {
    const check = validateSafeExternalUrl(cfg.baseUrl);
    if (!check.safe) {
      throw new Error(`SSRF_BLOCKED: ${check.reason}`);
    }
  }

  if (cfg.provider === "anthropic") {
    const headers: Record<string, string> = {};
    if (cfg.gatewayToken) {
      headers.Authorization = `Bearer ${cfg.gatewayToken}`;
    }
    const anthropic = createAnthropic({
      apiKey: cfg.apiKey,
      ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });
    return anthropic(cfg.model);
  }

  if (cfg.provider === "openai-compatible") {
    const openai = createOpenAI({
      apiKey: cfg.apiKey,
      ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}),
    });
    return openai.chat(cfg.model);
  }

  const google = createGoogleGenerativeAI({
    apiKey: cfg.apiKey,
    ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}),
  });
  return google(cfg.model);
}

/**
 * Unified LLM structured execution wrapper (Rule 42 & §4.4).
 * Uses temperature 0 for deterministic grading/analysis/jury calls.
 * Retries once on structured validation error.
 */
export async function generateStructured<TSchema extends z.ZodType>(params: {
  config: RuntimeLlmConfig;
  schema: TSchema;
  prompt: string;
  deterministic?: boolean;
  correlationId?: string;
}): Promise<
  | { ok: true; output: z.infer<TSchema>; attempts: number }
  | { ok: false; status: "needs_manual_review"; error: string }
> {
  const model = resolveModel(params.config);
  const temperature = params.deterministic === false ? (params.config.temperature ?? 0.9) : 0;

  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: params.schema }),
        prompt: params.prompt,
        temperature,
        maxOutputTokens: params.config.maxTokens ?? 8192,
      });

      logEvent("info", {
        correlation_id: params.correlationId,
        action: "llm.generateStructured",
        resource: `${params.config.provider}/${params.config.model}`,
        outcome: "success",
        duration_ms: Date.now() - started,
        meta: { attempt },
      });

      const validatedOutput = params.schema.parse(result.output);
      return { ok: true, output: validatedOutput, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logEvent("warn", {
        correlation_id: params.correlationId,
        action: "llm.generateStructured",
        resource: `${params.config.provider}/${params.config.model}`,
        outcome: "failure",
        duration_ms: Date.now() - started,
        meta: { attempt, reason: lastError },
      });
    }
  }

  return {
    ok: false,
    status: "needs_manual_review",
    error: `Structured output validation failed after 2 attempts: ${lastError}`,
  };
}
