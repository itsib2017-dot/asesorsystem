import { describe, expect, it } from "vitest";
import { computeVatmUnitRollup } from "../vatm-rollup";

const UNITS = [
  { code: "M.71KKK01.001.1", title: "Merancang Strategi Pengendalian Risiko K3" },
  { code: "M.71KKK01.002.1", title: "Merancang Sistem Tanggap Darurat" },
];

describe("Multi-channel VATM Unit Roll-up (T5 / Cacat 3)", () => {
  it("keeps aiRecommendation null when no assessment channel has run yet", () => {
    const out = computeVatmUnitRollup({ units: UNITS });
    expect(out).toHaveLength(2);
    expect(out[0]?.aiRecommendation).toBeNull();
    expect(out[1]?.aiRecommendation).toBeNull();
  });

  it("propagates BK from FR.IA.09 interview into unit roll-up even when written test passed K", () => {
    const out = computeVatmUnitRollup({
      units: UNITS,
      writtenGrading: {
        vatm_unit_recommendations: [
          {
            unitCode: "M.71KKK01.001.1",
            unitTitle: "Merancang Strategi Pengendalian Risiko K3",
            recommendation: "K",
            reasoning: "Jawaban tertulis lengkap.",
          },
          {
            unitCode: "M.71KKK01.002.1",
            unitTitle: "Merancang Sistem Tanggap Darurat",
            recommendation: "K",
            reasoning: "Jawaban tertulis lengkap.",
          },
        ],
      },
      interviewAssessment: {
        overall_recommendation: "BK",
        vatm_unit_recommendations: [
          {
            unitCode: "M.71KKK01.001.1",
            unitTitle: "Merancang Strategi Pengendalian Risiko K3",
            recommendation: "K",
            reasoning: "Portofolio HIRADC terkonfirmasi.",
          },
          {
            unitCode: "M.71KKK01.002.1",
            unitTitle: "Merancang Sistem Tanggap Darurat",
            recommendation: "BK",
            reasoning: "Tidak dapat menjelaskan prosedur evakuasi darurat saat wawancara.",
          },
        ],
      },
    });

    expect(out[0]?.aiRecommendation).toBe("K");
    expect(out[0]?.vatmReasoning).toContain("[Tertulis 06C: K]");
    expect(out[0]?.vatmReasoning).toContain("[Wawancara IA.09: K]");

    expect(out[1]?.aiRecommendation).toBe("BK");
    expect(out[1]?.vatmReasoning).toContain("[Wawancara IA.09: BK]");
    expect(out[1]?.vatmReasoning).toContain("prosedur evakuasi darurat");
  });
});
