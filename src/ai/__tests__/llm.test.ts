import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  outputObject: vi.fn((arg: unknown) => ({ kind: "object", arg })),
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
  Output: {
    object: mocks.outputObject,
  },
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => ({
    chat: vi.fn((model: string) => ({ provider: "openai-compatible", model })),
  })),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn((model: string) => ({ provider: "anthropic", model }))),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn((model: string) => ({ provider: "gemini", model }))),
}));

import {
  DEFAULT_LLM_ATTEMPT_TIMEOUT_MS,
  MAX_STRUCTURED_OUTPUT_TOKENS,
  MIN_LLM_RETRY_BUDGET_MS,
  generateStructured,
  type RuntimeLlmConfig,
} from "../llm";

const TestSchema = z.object({ answer: z.string() });

const baseConfig: RuntimeLlmConfig = {
  provider: "openai-compatible",
  apiKey: "test-key",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  temperature: 0.9,
  maxTokens: 52_100,
};

describe("generateStructured LLM dynamic time budget & token guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps oversized maxTokens (52100 -> 16384), sets maxRetries: 0, and grants 220s on attempt 1", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: { answer: "Kompeten" },
    });

    const out = await generateStructured({
      config: baseConfig,
      schema: TestSchema,
      prompt: "Test prompt",
      correlationId: "corr-cap-1",
    });

    expect(out).toEqual({
      ok: true,
      output: { answer: "Kompeten" },
      attempts: 1,
    });
    expect(DEFAULT_LLM_ATTEMPT_TIMEOUT_MS).toBe(220_000);
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0,
        maxOutputTokens: MAX_STRUCTURED_OUTPUT_TOKENS,
        maxRetries: 0,
        timeout: 220_000,
      }),
    );
  });

  it("stops immediately after a single timeout/abort without re-running the identical slow prompt", async () => {
    mocks.generateText.mockRejectedValueOnce(new Error("The operation was aborted due to timeout"));

    const out = await generateStructured({
      config: baseConfig,
      schema: TestSchema,
      prompt: "Test prompt",
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe("needs_manual_review");
      expect(out.error).toContain("melewati batas waktu 220 detik");
      expect(out.error).toContain("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
    }
  });

  it("retries fast non-timeout validation errors using remaining budget and recovers on attempt 2", async () => {
    mocks.generateText
      .mockRejectedValueOnce(new Error("Schema mismatch on first parse"))
      .mockResolvedValueOnce({ output: { answer: "Kompeten" } });

    const out = await generateStructured({
      config: { ...baseConfig, maxTokens: undefined },
      schema: TestSchema,
      prompt: "Test prompt",
      timeoutMs: 220_000,
      totalBudgetMs: 240_000,
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(mocks.generateText).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ maxOutputTokens: 8_192, timeout: 220_000 }),
    );
    expect(out).toEqual({
      ok: true,
      output: { answer: "Kompeten" },
      attempts: 2,
    });
  });

  it("skips attempt 2 when remaining totalBudgetMs is below MIN_LLM_RETRY_BUDGET_MS", async () => {
    mocks.generateText.mockRejectedValueOnce(new Error("Bad JSON output"));

    const out = await generateStructured({
      config: baseConfig,
      schema: TestSchema,
      prompt: "Test prompt",
      timeoutMs: 10_000,
      totalBudgetMs: MIN_LLM_RETRY_BUDGET_MS - 5_000,
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    expect(out).toEqual({
      ok: false,
      status: "needs_manual_review",
      error: "Structured output validation failed after 2 attempts: Bad JSON output",
    });
  });

  it("preserves validation failure prefix when both non-timeout attempts fail", async () => {
    mocks.generateText
      .mockRejectedValueOnce(new Error("Quota exceeded"))
      .mockRejectedValueOnce(new Error("Quota exceeded"));

    const out = await generateStructured({
      config: { ...baseConfig, maxTokens: undefined },
      schema: TestSchema,
      prompt: "Test prompt",
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(out).toEqual({
      ok: false,
      status: "needs_manual_review",
      error: "Structured output validation failed after 2 attempts: Quota exceeded",
    });
  });
});
