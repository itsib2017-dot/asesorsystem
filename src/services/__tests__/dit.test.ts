import { describe, it, expect } from "vitest";
import { checkDitCompletenessGate } from "../dit";
import { buildDitAnalysisSchema, buildInterviewQuestionsSchema } from "@/ai/schemas";

describe("DIT Completeness Gate & Dynamic Manifest Schema (Rule 26 & D21)", () => {
  it("rejects incomplete inputs and lists missing documents", () => {
    const res = checkDitCompletenessGate({
      frIa04aText: "Valid FR.IA.04A content with focus points.",
      presentationTranscript: "",
      candidateProfileSummary: null,
    });

    expect(res.passed).toBe(false);
    expect(res.missing.map((m) => m.input)).toEqual([
      "presentation_transcript",
      "candidate_profile",
    ]);
  });

  it("adapts question bank count dynamically from config (e.g. 10 instead of 13) and forbids Kompeten Bersyarat", () => {
    const schema10 = buildDitAnalysisSchema(10);

    const makeQuestions = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        no: i + 1,
        dimension: "TS" as const,
        kelompokPekerjaan: "KP 1",
        question: `Pertanyaan skenario STAR #${i + 1}`,
        modelAnswerKeyPoints: ["Poin kunci A"],
      }));

    const basePayload = {
      candidateProfileSummary: {
        pseudonym: "ASESI-001",
        educationalBackground: "S1 Teknik",
        workExperienceSummary: "3 tahun HSE",
        roleLevel: "Profesional",
        region: "Jakarta",
        industrySector: "Manufaktur",
      },
      coverageMatrix: [],
      gapQuestions: [],
      readiness: {
        readiness_pct: 80,
        strengths: ["Kuat di inspeksi"],
        critical_gaps: [],
        follow_up_actions: [],
        recommendation: "Kompeten" as const,
        readiness_recommendation_note: "Siap",
      },
    };

    expect(
      schema10.safeParse({ ...basePayload, questionBank: makeQuestions(10) }).success,
    ).toBe(true);

    // Must fail if model returns 9 or 13 when configured count is 10
    expect(
      schema10.safeParse({ ...basePayload, questionBank: makeQuestions(13) }).success,
    ).toBe(false);

    // Must fail on prohibited 'Kompeten Bersyarat' (D15)
    expect(
      schema10.safeParse({
        ...basePayload,
        questionBank: makeQuestions(10),
        readiness: {
          ...basePayload.readiness,
          recommendation: "Kompeten Bersyarat",
        },
      }).success,
    ).toBe(false);
  });

  it("validates RCTFA 5-dimension code on interviewQuestions schema items", () => {
    const schema3 = buildInterviewQuestionsSchema(3);
    const valid = schema3.safeParse({
      coverage: [],
      gapQuestions: [],
      interviewQuestions: [
        { no: 1, unitCode: "U1", dimension: "TS", question: "Q1" },
        { no: 2, unitCode: "U2", dimension: "CMS", question: "Q2" },
        { no: 3, unitCode: "U3", dimension: "TrS", question: "Q3" },
      ],
      readiness: {
        strengths: ["Kuat"],
        criticalGaps: [],
        recommendation: "K",
      },
    });
    expect(valid.success).toBe(true);

    const missingDimension = schema3.safeParse({
      coverage: [],
      gapQuestions: [],
      interviewQuestions: [
        { no: 1, unitCode: "U1", question: "Q1" },
        { no: 2, unitCode: "U2", dimension: "CMS", question: "Q2" },
        { no: 3, unitCode: "U3", dimension: "TrS", question: "Q3" },
      ],
      readiness: {
        strengths: ["Kuat"],
        criticalGaps: [],
        recommendation: "K",
      },
    });
    expect(missingDimension.success).toBe(false);
  });
});
