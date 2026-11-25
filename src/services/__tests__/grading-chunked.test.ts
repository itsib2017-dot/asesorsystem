import { describe, expect, it, vi } from "vitest";
import {
  buildQuestionRanges,
  mergeItemVerdicts,
  runWrittenGradingPipeline,
} from "../grading";
import type { generateStructured } from "@/ai/llm";

const KEY =
  "Kunci jawaban 1. Identifikasi bahaya dilakukan dengan inspeksi tempat kerja secara berkala dan menyeluruh. 2. Pengendalian risiko mengikuti hierarki eliminasi substitusi rekayasa administrasi dan alat pelindung diri.";
const ANSWER = "1. Inspeksi rutin. 2. Pakai APD saja.";
const units = [
  { code: "U1", title: "Unit 1" },
  { code: "U2", title: "Unit 2" },
];
const llmConfig = { provider: "openai-compatible" as const, apiKey: "test", model: "m" };

function verdict(no: number, v: "Benar" | "Sebagian" | "Salah" = "Benar") {
  return { questionNo: no, verdict: v, masterSpan: "k", studentSpan: "s", explanation: "e" };
}

const rollupOutput = {
  vatmUnitRecommendations: units.map((u) => ({
    unitCode: u.code,
    unitTitle: u.title,
    valid: true,
    asli: true,
    terkini: true,
    memadai: true,
    recommendation: "K",
    reasoning: "ok",
  })),
  plagiarismReport: { status: "Bersih", reasoning: "ok", flaggedQuestions: [] },
};

function fakeGenerate(failRange?: string) {
  return vi.fn(async (p: { prompt: string; correlationId?: string }) => {
    if (p.correlationId?.endsWith(":rollup")) return { ok: true, output: rollupOutput, attempts: 1 };
    const m = /soal nomor (\d+) sampai (\d+)/.exec(p.prompt);
    const from = Number(m?.[1]);
    const to = Number(m?.[2]);
    if (failRange === `${from}-${to}`) {
      return { ok: false, status: "needs_manual_review", error: "No output generated." };
    }
    const items = [];
    for (let n = from; n <= to; n++) items.push(verdict(n, n === 2 ? "Salah" : "Benar"));
    return { ok: true, output: { itemVerdicts: items }, attempts: 1 };
  }) as unknown as typeof generateStructured;
}

describe("buildQuestionRanges", () => {
  it("splits 13 questions into chunks of 4", () => {
    expect(buildQuestionRanges(13, 4)).toEqual([
      { from: 1, to: 4 },
      { from: 5, to: 8 },
      { from: 9, to: 12 },
      { from: 13, to: 13 },
    ]);
  });
  it("handles a single question (boundary)", () => {
    expect(buildQuestionRanges(1, 4)).toEqual([{ from: 1, to: 1 }]);
  });
});

describe("mergeItemVerdicts", () => {
  it("dedupes, drops out-of-range numbers and sorts", () => {
    const merged = mergeItemVerdicts([verdict(3), verdict(1), verdict(3, "Salah"), verdict(99)], 13);
    expect(merged.map((v) => v.questionNo)).toEqual([1, 3]);
    expect(merged[1]!.verdict).toBe("Benar");
  });
});

describe("runWrittenGradingPipeline (chunked)", () => {
  it("grades 13 questions in 4 chunks + 1 rollup and derives ringkasanKesalahan", async () => {
    const generate = fakeGenerate();
    const res = await runWrittenGradingPipeline({
      pseudonym: "ASESI-001",
      schemeName: "AK3U",
      units,
      masterKeyText: KEY,
      studentAnswerText: ANSWER,
      llmConfig,
      correlationId: "job-1",
      questionCount: 13,
      generate,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(generate).toHaveBeenCalledTimes(5);
    expect(res.output.itemVerdicts).toHaveLength(13);
    expect(res.output.ringkasanKesalahan).toEqual([2]);
    expect(res.output.plagiarismReport.status).toBe("Bersih");
    expect(res.promptVersion).toBe("v2.0.0-chunked");
  });

  it("fails all-or-nothing and names the failed range (no partial persistence)", async () => {
    const generate = fakeGenerate("5-8");
    const res = await runWrittenGradingPipeline({
      pseudonym: "ASESI-001",
      schemeName: "AK3U",
      units,
      masterKeyText: KEY,
      studentAnswerText: ANSWER,
      llmConfig,
      questionCount: 13,
      generate,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("Soal 5–8");
    expect(res.error).toContain("No output generated");
  });

  it("rejects empty student answer before any LLM call (malformed input)", async () => {
    const generate = fakeGenerate();
    const res = await runWrittenGradingPipeline({
      pseudonym: "ASESI-001",
      schemeName: "AK3U",
      units,
      masterKeyText: KEY,
      studentAnswerText: "   ",
      llmConfig,
      generate,
    });
    expect(res.ok).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });
});
