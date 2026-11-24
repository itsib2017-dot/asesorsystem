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

export const MAX_STRUCTURED_OUTPUT_TOKENS = 16_384;
export const DEFAULT_LLM_TOTAL_BUDGET_MS = 240_000;
export const DEFAULT_LLM_ATTEMPT_TIMEOUT_MS = 220_000;
export const MIN_LLM_RETRY_BUDGET_MS = 30_000;

export function isLlmTimeoutError(message: string): boolean {
  return /\b(?:abort|aborted|timeout|timed out)\b/i.test(message);
}

/**
 * Unified LLM structured execution wrapper (Rule 42 & §4.4).
 * Uses temperature 0 for deterministic grading/analysis/jury calls.
 * Allocates up to 220s on attempt 1 inside a 240s total budget so reasoning
 * models finish cleanly under Vercel's 300s limit, retries once only for fast
 * non-timeout failures when ≥30s budget remains, and caps output tokens.
 */
export async function generateStructured<TSchema extends z.ZodType>(params: {
  config: RuntimeLlmConfig;
  schema: TSchema;
  prompt: string;
  deterministic?: boolean;
  correlationId?: string;
  timeoutMs?: number;
  totalBudgetMs?: number;
}): Promise<
  | { ok: true; output: z.infer<TSchema>; attempts: number }
  | { ok: false; status: "needs_manual_review"; error: string }
> {
  const model = resolveModel(params.config);
  const temperature = params.deterministic === false ? (params.config.temperature ?? 0.9) : 0;
  const effectiveMaxTokens = Math.min(
    Math.max(512, params.config.maxTokens ?? 8_192),
    MAX_STRUCTURED_OUTPUT_TOKENS,
  );
  const attemptCapMs = params.timeoutMs ?? DEFAULT_LLM_ATTEMPT_TIMEOUT_MS;
  const totalBudgetMs =
    params.totalBudgetMs ?? Math.max(DEFAULT_LLM_TOTAL_BUDGET_MS, attemptCapMs);
  const deadline = Date.now() + totalBudgetMs;

  let lastError = "";
  let lastAttemptTimeoutMs = attemptCapMs;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const remainingMs = deadline - Date.now();
    if (attempt > 1 && remainingMs < MIN_LLM_RETRY_BUDGET_MS) {
      break;
    }

    const callTimeoutMs = Math.max(1_000, Math.min(attemptCapMs, remainingMs));
    lastAttemptTimeoutMs = callTimeoutMs;
    const started = Date.now();

    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: params.schema }),
        prompt: params.prompt,
        temperature,
        maxOutputTokens: effectiveMaxTokens,
        maxRetries: 0,
        timeout: callTimeoutMs,
      });

      logEvent("info", {
        correlation_id: params.correlationId,
        action: "llm.generateStructured",
        resource: `${params.config.provider}/${params.config.model}`,
        outcome: "success",
        duration_ms: Date.now() - started,
        meta: { attempt, maxOutputTokens: effectiveMaxTokens, timeoutMs: callTimeoutMs },
      });

      const validatedOutput = params.schema.parse(result.output);
      return { ok: true, output: validatedOutput, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const timedOut = isLlmTimeoutError(lastError);
      logEvent("warn", {
        correlation_id: params.correlationId,
        action: "llm.generateStructured",
        resource: `${params.config.provider}/${params.config.model}`,
        outcome: "failure",
        duration_ms: Date.now() - started,
        meta: { attempt, reason: lastError, timeoutMs: callTimeoutMs, timedOut },
      });

      // Never re-run an identical prompt after a timeout/abort; fail cleanly instead.
      if (timedOut) {
        break;
      }
    }
  }

  return {
    ok: false,
    status: "needs_manual_review",
    error: isLlmTimeoutError(lastError)
      ? `Permintaan ke model AI (${params.config.provider}/${params.config.model}) melewati batas waktu ${Math.round(lastAttemptTimeoutMs / 1000)} detik (${lastError}).`
      : `Structured output validation failed after 2 attempts: ${lastError}`,
  };
}
