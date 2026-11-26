import { describe, expect, it, vi } from "vitest";
import {
  buildQuestionRanges,
  filterVerdictsToRange,
  mergeItemVerdicts,
  runWrittenGradingPipeline,
} from "../grading";
import { buildWrittenGradingChunkPrompt } from "@/ai/prompts/written-test-grading.v2";
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

  it("drops out-of-range stray verdicts from chunk A so chunk B owns its question (N2)", async () => {
    const generate = vi.fn(async (p: { prompt: string; correlationId?: string }) => {
      if (p.correlationId?.endsWith(":rollup")) return { ok: true, output: rollupOutput, attempts: 1 };
      const m = /soal nomor (\d+) sampai (\d+)/.exec(p.prompt);
      const from = Number(m?.[1]);
      const to = Number(m?.[2]);
      if (from === 9 && to === 12) {
        return {
          ok: true,
          output: {
            itemVerdicts: [
              verdict(9),
              verdict(10),
              verdict(11),
              verdict(12),
              // Stray out-of-range verdict for #13 trying to bleed into chunk 9-12
              { questionNo: 13, verdict: "Salah", masterSpan: "k-bleed", studentSpan: "s-bleed", explanation: "duplikat" },
            ],
          },
          attempts: 1,
        };
      }
      const items = [];
      for (let n = from; n <= to; n++) {
        items.push({
          questionNo: n,
          verdict: "Benar" as const,
          masterSpan: `k-${n}`,
          studentSpan: `s-${n}`,
          explanation: `Penjelasan soal ${n}`,
        });
      }
      return { ok: true, output: { itemVerdicts: items }, attempts: 1 };
    }) as unknown as typeof generateStructured;

    const res = await runWrittenGradingPipeline({
      pseudonym: "ASESI-001",
      schemeName: "AK3U",
      units,
      masterKeyText: KEY,
      studentAnswerText: ANSWER,
      llmConfig,
      correlationId: "job-n2",
      questionCount: 13,
      generate,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const q13 = res.output.itemVerdicts.find((v) => v.questionNo === 13);
    expect(q13?.verdict).toBe("Benar");
    expect(q13?.explanation).toBe("Penjelasan soal 13");
  });

  it("runs a targeted recovery pass when a chunk omits questions and updates ringkasanKesalahan (N1/N3)", async () => {
    const progressCalls: number[] = [];
    const generate = vi.fn(async (p: { prompt: string; correlationId?: string }) => {
      if (p.correlationId?.endsWith(":rollup")) return { ok: true, output: rollupOutput, attempts: 1 };
      if (p.correlationId?.includes(":recover-")) {
        return {
          ok: true,
          output: {
            itemVerdicts: [
              verdict(10, "Sebagian"),
              verdict(11, "Benar"),
              verdict(12, "Salah"),
            ],
          },
          attempts: 1,
        };
      }
      const m = /soal nomor (\d+) sampai (\d+)/.exec(p.prompt);
      const from = Number(m?.[1]);
      const to = Number(m?.[2]);
      const items = [];
      for (let n = from; n <= to; n++) {
        if (n >= 10 && n <= 12) continue; // Simulate omitted questions
        items.push(verdict(n, "Benar"));
      }
      return { ok: true, output: { itemVerdicts: items }, attempts: 1 };
    }) as unknown as typeof generateStructured;

    const res = await runWrittenGradingPipeline({
      pseudonym: "ASESI-001",
      schemeName: "AK3U",
      units,
      masterKeyText: KEY,
      studentAnswerText: ANSWER,
      llmConfig,
      correlationId: "job-n1",
      questionCount: 13,
      onProgress: (pct) => {
        progressCalls.push(pct);
      },
      generate,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.output.itemVerdicts).toHaveLength(13);
    expect(res.output.ringkasanKesalahan).toEqual([10, 12]);
    // Chunk progress + recovery + rollup progress (N4)
    expect(progressCalls[0]).toBe(15);
    expect(progressCalls).toContain(75);
    expect(progressCalls).toContain(85);
    expect(progressCalls[progressCalls.length - 1]).toBe(95);
    for (let i = 1; i < progressCalls.length; i++) {
      expect(progressCalls[i]!).toBeGreaterThanOrEqual(progressCalls[i - 1]!);
    }
  });
});

describe("filterVerdictsToRange & chunk prompt guardrails", () => {
  it("filters strictly to [from, to] and optional target set", () => {
    const filtered = filterVerdictsToRange(
      [verdict(8), verdict(9), verdict(10), verdict(13)],
      9,
      12,
      new Set([10]),
    );
    expect(filtered.map((v) => v.questionNo)).toEqual([10]);
  });

  it("enforces Indonesian output and instructs LLM to ignore FR.IA.06B/06C form codes", () => {
    const prompt = buildWrittenGradingChunkPrompt({
      pseudonym: "ASESI-001",
      schemeName: "AK3U",
      masterKeyText: "1. Definisi bahaya.\n2. Hierarki pengendalian.",
      studentAnswerText: "FR.IA.06C\n1. Bahaya adalah sumber.",
      fromQuestion: 1,
      toQuestion: 2,
      targetQuestionNumbers: [1, 2],
    });
    expect(prompt).toContain("Bahasa Indonesia");
    expect(prompt).toContain("FR.IA.06B");
    expect(prompt).toContain("[FOKUS KUNCI NOMOR TARGET]");
  });
});
