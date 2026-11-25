import { describe, expect, it } from "vitest";
import {
  buildIa06cAiProposals,
  buildIa06cPayload,
  extractOfficial06cAssessment,
  hasSavedOfficial06cAssessment,
} from "../assessee-forms";

describe("FR.IA.06C AI proposals and official-on-save boundary", () => {
  it("maps itemVerdicts (Benar->Ya, Salah->Tidak, Sebagian->Belum) and overall recommendation", () => {
    const proposal = buildIa06cAiProposals({
      writtenGrading: {
        item_verdicts: [
          {
            questionNo: 1,
            verdict: "Benar",
            studentSpan: "Jawaban nomor 1 tepat.",
            explanation: "Lengkap sesuai kunci.",
          },
          {
            questionNo: 2,
            verdict: "Salah",
            studentSpan: "Jawaban nomor 2 keliru.",
            explanation: "Tidak menyebut regulasi.",
          },
          {
            questionNo: 3,
            verdict: "Sebagian",
            studentSpan: "Menyebut sebagian langkah.",
            explanation: "Kurang penjelasan kalibrasi.",
          },
        ],
        vatm_unit_recommendations: [
          { unitCode: "M.71KKK01.005.1", unitTitle: "Pengukuran Bahaya", recommendation: "BK" },
        ],
      },
    });

    expect(proposal.hasProposal).toBe(true);
    expect(proposal.items).toHaveLength(13);
    expect(proposal.items[0]).toMatchObject({
      questionNo: 1,
      achieved: true,
      sourceVerdict: "Benar",
      answerText: "Jawaban nomor 1 tepat.",
    });
    expect(proposal.items[1]).toMatchObject({
      questionNo: 2,
      achieved: false,
      sourceVerdict: "Salah",
    });
    expect(proposal.items[2]).toMatchObject({
      questionNo: 3,
      achieved: null,
      sourceVerdict: "Sebagian",
      answerText: "[Sebagian] Menyebut sebagian langkah.",
    });
    expect(proposal.overallAchieved).toBe(false);
    expect(proposal.feedbackDetail).toContain("M.71KKK01.005.1");
  });

  it("proposes overall true when all verdicts are Benar, and null when Sebagian exists without Salah/BK", () => {
    const allBenar = buildIa06cAiProposals({
      writtenGrading: {
        itemVerdicts: [
          { questionNo: 1, verdict: "Benar", studentSpan: "A" },
          { questionNo: 2, verdict: "Benar", studentSpan: "B" },
        ],
        vatmUnitRecommendations: [
          { unitCode: "U1", unitTitle: "Unit 1", recommendation: "K" },
        ],
      },
    });
    expect(allBenar.overallAchieved).toBe(true);

    const partialOnly = buildIa06cAiProposals({
      writtenGrading: {
        itemVerdicts: [
          { questionNo: 1, verdict: "Benar", studentSpan: "A" },
          { questionNo: 2, verdict: "Sebagian", studentSpan: "B" },
        ],
        vatmUnitRecommendations: [],
      },
    });
    expect(partialOnly.overallAchieved).toBeNull();
  });

  it("extracts official06c from form_mapping and preserves neutrality until saved", () => {
    const unsavedGrading = {
      form_mapping: { soal: "06A", kunci: "06B", jawaban: "06C" },
      item_verdicts: [
        { questionNo: 1, verdict: "Benar", studentSpan: "Jawaban A" },
        { questionNo: 2, verdict: "Salah", studentSpan: "Jawaban B" },
      ],
      vatm_unit_recommendations: [
        { unitCode: "U1", unitTitle: "Unit 1", recommendation: "BK" },
      ],
    };

    const extractedUnsaved = extractOfficial06cAssessment(unsavedGrading);
    expect(hasSavedOfficial06cAssessment(extractedUnsaved)).toBe(false);

    const neutralPayload = buildIa06cPayload({
      schemeTitle: "AK3U",
      schemeNumber: "SKM/1",
      assessorName: "Asesor",
      assessorRegNo: "MET.1",
      assesseeName: "Asesi",
      assessmentDate: "2026-11-25",
      writtenGrading: unsavedGrading,
    });
    expect(neutralPayload.answers[0]?.answerText).toBe("Jawaban A");
    expect(neutralPayload.answers.every((a) => a.achieved === null)).toBe(true);
    expect(neutralPayload.overallAchieved).toBeNull();
    expect(neutralPayload.feedbackDetail).toBeUndefined();

    const savedGrading = {
      ...unsavedGrading,
      confirmed_by: "user-1",
      confirmed_at: "2026-11-25T09:00:00.000Z",
      form_mapping: {
        soal: "06A",
        kunci: "06B",
        jawaban: "06C",
        official06c: {
          items: [
            { questionNo: 1, answerText: "Jawaban A (dikoreksi)", achieved: false },
            { questionNo: 2, answerText: "", achieved: true },
          ],
          overallAchieved: true,
          feedbackDetail: "Ditetapkan tercapai setelah klarifikasi.",
          assessedBy: "user-1",
          assessedAt: "2026-11-25T09:00:00.000Z",
        },
      },
    };

    const extractedSaved = extractOfficial06cAssessment(savedGrading);
    expect(hasSavedOfficial06cAssessment(extractedSaved)).toBe(true);

    const savedPayload = buildIa06cPayload({
      schemeTitle: "AK3U",
      schemeNumber: "SKM/1",
      assessorName: "Asesor",
      assessorRegNo: "MET.1",
      assesseeName: "Asesi",
      assessmentDate: "2026-11-25",
      writtenGrading: savedGrading,
    });
    expect(savedPayload.answers[0]).toEqual({
      questionNo: 1,
      answerText: "Jawaban A (dikoreksi)",
      achieved: false,
    });
    expect(savedPayload.answers[1]).toEqual({
      questionNo: 2,
      answerText: "Jawaban B",
      achieved: true,
    });
    expect(savedPayload.overallAchieved).toBe(true);
    expect(savedPayload.feedbackDetail).toBe("Ditetapkan tercapai setelah klarifikasi.");
  });
});
