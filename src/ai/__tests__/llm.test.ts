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

describe("generateStructured LLM timeout & token guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps oversized maxTokens (52100 -> 16384), sets maxRetries: 0, and applies 115s timeout", async () => {
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
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0,
        maxOutputTokens: MAX_STRUCTURED_OUTPUT_TOKENS,
        maxRetries: 0,
        timeout: DEFAULT_LLM_ATTEMPT_TIMEOUT_MS,
      }),
    );
  });

  it("returns actionable Indonesian timeout message when both attempts abort/timeout", async () => {
    mocks.generateText
      .mockRejectedValueOnce(new Error("The operation was aborted due to timeout"))
      .mockRejectedValueOnce(new Error("Request timed out after 115000ms"));

    const out = await generateStructured({
      config: baseConfig,
      schema: TestSchema,
      prompt: "Test prompt",
      timeoutMs: 115_000,
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe("needs_manual_review");
      expect(out.error).toContain("melewati batas waktu 115 detik per percobaan");
      expect(out.error).toContain("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
    }
    expect(mocks.generateText).toHaveBeenCalledTimes(2);
  });

  it("preserves validation failure prefix for non-timeout errors across 2 attempts", async () => {
    mocks.generateText
      .mockRejectedValueOnce(new Error("Quota exceeded"))
      .mockRejectedValueOnce(new Error("Quota exceeded"));

    const out = await generateStructured({
      config: { ...baseConfig, maxTokens: undefined },
      schema: TestSchema,
      prompt: "Test prompt",
    });

    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 8_192,
      }),
    );
    expect(out).toEqual({
      ok: false,
      status: "needs_manual_review",
      error: "Structured output validation failed after 2 attempts: Quota exceeded",
    });
  });
});
