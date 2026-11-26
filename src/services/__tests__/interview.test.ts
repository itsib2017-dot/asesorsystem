import { describe, expect, it } from "vitest";
import { normalizeInterviewQuestions } from "../interview";

const UNITS = [
  { code: "U.001", title: "Unit 1" },
  { code: "U.002", title: "Unit 2" },
  { code: "U.003", title: "Unit 3" },
  { code: "U.004", title: "Unit 4" },
  { code: "U.005", title: "Unit 5" },
  { code: "U.006", title: "Unit 6" },
  { code: "U.007", title: "Unit 7" },
];

describe("normalizeInterviewQuestions (P1-1, P1-2, P1-3)", () => {
  it("enforces all 5 RCTFA dimensions when model omits CMS and TrS", () => {
    const raw = [
      { no: 1, unitCode: "U.001", dimension: "TS" as const, question: "(Situation) S1 (Task) T1 (Action) A1 (Result) R1?" },
      { no: 2, unitCode: "U.002", dimension: "TMS" as const, question: "(Situation) S2 (Task) T2 (Action) A2 (Result) R2?" },
      { no: 3, unitCode: "U.003", dimension: "JRES" as const, question: "(Situation) S3 (Task) T3 (Action) A3 (Result) R3?" },
      { no: 4, unitCode: "U.004", dimension: "TMS" as const, question: "(Situation) S4 (Task) T4 (Action) A4 (Result) R4?" },
      { no: 5, unitCode: "U.005", dimension: "JRES" as const, question: "(Situation) S5 (Task) T5 (Action) A5 (Result) R5?" },
      { no: 6, unitCode: "U.006", dimension: "TMS" as const, question: "(Situation) S6 (Task) T6 (Action) A6 (Result) R6?" },
      { no: 7, unitCode: "U.007", dimension: "JRES" as const, question: "(Situation) S7 (Task) T7 (Action) A7 (Result) R7?" },
    ];

    const normalized = normalizeInterviewQuestions(raw, UNITS, 7);
    const dims = new Set(normalized.map((q) => q.dimension));
    expect(dims).toEqual(new Set(["TS", "TMS", "CMS", "JRES", "TrS"]));
  });

  it("sorts by unit order, fixes duplicate question numbers (#7/#7 -> 1..N), and enforces STAR prefix", () => {
    const raw = [
      { no: 7, unitCode: "U.003", dimension: "TS" as const, question: "Jelaskan langkah inspeksi K3." },
      { no: 7, unitCode: "U.001", dimension: "TMS" as const, question: "(Situation) Saat audit (Task) tugas (Action) aksi (Result) hasil?" },
      { no: 2, unitCode: "U.002", dimension: "CMS" as const, question: "Bagaimana mitigasi darurat?" },
    ];

    const normalized = normalizeInterviewQuestions(raw, UNITS.slice(0, 3), 3);
    expect(normalized.map((q) => q.unitCode)).toEqual(["U.001", "U.002", "U.003"]);
    expect(normalized.map((q) => q.no)).toEqual([1, 2, 3]);
    expect(normalized[0]?.question.startsWith("(Situation)")).toBe(true);
    expect(normalized[1]?.question.startsWith("(Situation/Task/Action/Result)")).toBe(true);
    expect(normalized[2]?.question.startsWith("(Situation/Task/Action/Result)")).toBe(true);
  });
});
