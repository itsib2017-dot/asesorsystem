import { describe, it, expect } from "vitest";
import { checkDitCompletenessGate } from "../dit";
import { buildDitGapAnalysisPrompt, compactDitPromptSection } from "@/ai/prompts/dit-gap-analysis.v1";
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

  it("compacts Excel merge repetition, [object Object], and dot placeholders losslessly in buildDitGapAnalysisPrompt", () => {
    const noisyPresentation = [
      "--- Sheet: IBPR kosong ---",
      " |  | ….................. | ….................. | …..................",
      " |  | DEPARTEMEN : | DEPARTEMEN : | DEPARTEMEN :",
      "KODE TEMPAT | AKTIVITAS | BAHAYA | RISIKO",
      "KODE TEMPAT | AKTIVITAS | BAHAYA | RISIKO",
      "1 | WWT AREA | CLEANING TANKI | Gas H2S dan limbah B3 | Sesak napas dan pencemaran | 16 | Tinggi",
      "[object Object] | [object Object] | Penilaian risiko kuantitatif",
    ].join("\n");

    const compacted = compactDitPromptSection(noisyPresentation, 24_000);
    expect(compacted).not.toContain("[object Object]");
    expect(compacted).not.toContain("…..................");
    expect(compacted).not.toContain("DEPARTEMEN : | DEPARTEMEN :");
    expect(compacted).toContain("CLEANING TANKI | Gas H2S dan limbah B3");
    expect(compacted).toContain("Penilaian risiko kuantitatif");

    const prompt = buildDitGapAnalysisPrompt({
      pseudonym: "ASESI-001",
      schemeName: "Ahli K3 Umum",
      questionCount: 13,
      legalRefs: ["Permenaker No. 2/1992"],
      frIa04aText: "Instruksi proyek terstruktur K3\n\n\n\nDetail penugasan lapangan.",
      presentationTranscript: noisyPresentation,
      candidateProfileSummary: "Pengalaman HSE 4 tahun.",
    });

    expect(prompt).not.toContain("[object Object]");
    expect(prompt).toContain("CLEANING TANKI | Gas H2S dan limbah B3");
    expect(prompt).toContain("ASESI-001");
  });
});
