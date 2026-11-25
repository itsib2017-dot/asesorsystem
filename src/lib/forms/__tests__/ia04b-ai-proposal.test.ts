import { describe, expect, it } from "vitest";
import {
  buildIa04bAiProposals,
  buildIa04bPayload,
  extractOfficial04bAssessment,
  hasSavedOfficial04bAssessment,
  IA04B_KELOMPOK_PEKERJAAN,
} from "../assessee-forms";

describe("FR.IA.04B AI proposals and official-on-save boundary", () => {
  it("maps coverageMatrix statuses (Terpenuhi->Ya, Belum Dibahas->Tidak, Sebagian->Belum) and binary readiness", () => {
    const flatAspects = IA04B_KELOMPOK_PEKERJAAN.flatMap((kp) => kp.aspects);
    const coverageMatrix = flatAspects.map((asp, idx) => ({
      no: idx + 1,
      kelompokPekerjaan: `Kelompok Pekerjaan ${asp.kpIndex}`,
      focusPoint: `${asp.unitCode} ${asp.lingkup}`,
      status:
        idx === 0
          ? "Terpenuhi"
          : idx === 1
            ? "Belum Dibahas"
            : idx === 2
              ? "Sebagian"
              : "Terpenuhi",
      evidenceSpan: `Kutipan bukti #${idx + 1}`,
      notes: "",
    }));

    const proposal = buildIa04bAiProposals({
      ditAnalysis: {
        coverageMatrix,
        readiness: {
          readiness_pct: 78,
          recommendation: "Belum Kompeten",
          readiness_recommendation_note: "Unit pengukuran bahaya belum tuntas.",
        },
      },
    });

    expect(proposal.hasProposal).toBe(true);
    expect(proposal.items).toHaveLength(13);
    expect(proposal.items[0]?.achieved).toBe(true);
    expect(proposal.items[0]?.sourceStatus).toBe("Terpenuhi");
    expect(proposal.items[0]?.evidenceSpan).toBe("Kutipan bukti #1");
    expect(proposal.items[1]?.achieved).toBe(false);
    expect(proposal.items[1]?.sourceStatus).toBe("Belum Dibahas");
    expect(proposal.items[2]?.achieved).toBeNull();
    expect(proposal.items[2]?.sourceStatus).toBe("Sebagian");
    expect(proposal.overallRecommendation).toBe("BK");
    expect(proposal.readinessPct).toBe(78);
    expect(proposal.readinessNote).toBe("Unit pengukuran bahaya belum tuntas.");
  });

  it("enforces strict binary K/BK on readinessRecommendation while deriving overallRecommendation from items only", () => {
    const proposalK = buildIa04bAiProposals({
      ditAnalysis: {
        coverage_matrix: [],
        readiness: {
          recommendation: "Kompeten",
          readiness_pct: 92,
          readiness_recommendation_note: "Asesi menenangkan persyaratan sertifikasi dengan baik.",
        },
      },
    });
    expect(proposalK.readinessRecommendation).toBe("K");
    expect(proposalK.overallRecommendation).toBeNull();
    expect(proposalK.readinessNote).toBe("Asesi memenuhi persyaratan sertifikasi dengan baik.");

    const proposalThird = buildIa04bAiProposals({
      ditAnalysis: {
        coverage_matrix: [],
        readiness: { recommendation: "Kompeten Bersyarat", readiness_pct: 60 },
      },
    });
    expect(proposalThird.readinessRecommendation).toBeNull();
    expect(proposalThird.overallRecommendation).toBeNull();
  });

  it("never proposes K when any aspect is Belum or Tidak (live ASESI-001 8 Ya / 5 Belum case)", () => {
    const flatAspects = IA04B_KELOMPOK_PEKERJAAN.flatMap((kp) => kp.aspects);
    const eightYaFiveBelum = flatAspects.map((asp, idx) => ({
      no: idx + 1,
      kelompokPekerjaan: `Kelompok Pekerjaan ${asp.kpIndex}`,
      focusPoint: `${asp.unitCode} ${asp.lingkup}`,
      status: idx < 8 ? "Terpenuhi" : "Sebagian",
    }));

    const partialProposal = buildIa04bAiProposals({
      ditAnalysis: {
        coverageMatrix: eightYaFiveBelum,
        readiness: { recommendation: "Kompeten", readiness_pct: 100 },
      },
    });
    expect(partialProposal.items.filter((i) => i.achieved === true)).toHaveLength(8);
    expect(partialProposal.items.filter((i) => i.achieved === null)).toHaveLength(5);
    expect(partialProposal.overallRecommendation).toBeNull();
    expect(partialProposal.readinessPct).toBe(100);
    expect(partialProposal.readinessRecommendation).toBe("K");

    const oneTidakProposal = buildIa04bAiProposals({
      ditAnalysis: {
        coverageMatrix: flatAspects.map((asp, idx) => ({
          no: idx + 1,
          kelompokPekerjaan: `Kelompok Pekerjaan ${asp.kpIndex}`,
          focusPoint: `${asp.unitCode} ${asp.lingkup}`,
          status: idx === 12 ? "Belum Dibahas" : "Terpenuhi",
        })),
        readiness: { recommendation: "Kompeten", readiness_pct: 95 },
      },
    });
    expect(oneTidakProposal.overallRecommendation).toBe("BK");

    const allYaProposal = buildIa04bAiProposals({
      ditAnalysis: {
        coverageMatrix: flatAspects.map((asp, idx) => ({
          no: idx + 1,
          kelompokPekerjaan: `Kelompok Pekerjaan ${asp.kpIndex}`,
          focusPoint: `${asp.unitCode} ${asp.lingkup}`,
          status: "Terpenuhi",
        })),
        readiness: { recommendation: "Kompeten", readiness_pct: 100 },
      },
    });
    expect(allYaProposal.overallRecommendation).toBe("K");
  });

  it("matches aspects by unitCode or focusPoint even when coverageMatrix is shuffled or partial", () => {
    const proposal = buildIa04bAiProposals({
      ditAnalysis: {
        coverageMatrix: [
          {
            no: 1,
            kelompokPekerjaan: "Kelompok Pekerjaan 4",
            focusPoint: "M.71KKK01.013.1 Investigasi Kecelakaan Kerja",
            status: "Belum Dibahas",
            evidenceSpan: "Tidak ditemukan dalam salindia.",
          },
          {
            no: 2,
            kelompokPekerjaan: "Kelompok Pekerjaan 1",
            focusPoint: "Pengukuran Faktor Bahaya di Tempat Kerja",
            status: "Sebagian",
            evidenceSpan: "Menyebut NAB kebisingan namun alat ukur belum lengkap.",
          },
          {
            no: 3,
            kelompokPekerjaan: "Kelompok Pekerjaan 1",
            focusPoint: "M.71KKK01.001.1 Pengendalian Risiko",
            status: "Terpenuhi",
            evidenceSpan: "Menjelaskan HIRADC lengkap.",
          },
        ],
      },
    });

    const kp1No1 = proposal.items.find((i) => i.kpIndex === 1 && i.no === 1);
    const kp1No2 = proposal.items.find((i) => i.kpIndex === 1 && i.no === 2);
    const kp4No1 = proposal.items.find((i) => i.kpIndex === 4 && i.no === 1);
    const kp2No1 = proposal.items.find((i) => i.kpIndex === 2 && i.no === 1);

    expect(kp1No1?.achieved).toBe(true);
    expect(kp1No2?.achieved).toBeNull();
    expect(kp1No2?.sourceStatus).toBe("Sebagian");
    expect(kp4No1?.achieved).toBe(false);
    expect(kp2No1?.achieved).toBeNull();
    expect(kp2No1?.sourceStatus).toBeNull();
  });

  it("supports 4-row KP-level coverageMatrix fallback without corrupting unmatched KPs", () => {
    const proposal = buildIa04bAiProposals({
      ditAnalysis: {
        coverageMatrix: [
          { no: 1, kelompokPekerjaan: "Kelompok Pekerjaan 1", focusPoint: "KP 1", status: "Terpenuhi" },
          { no: 2, kelompokPekerjaan: "Kelompok Pekerjaan 2", focusPoint: "KP 2", status: "Belum Dibahas" },
          { no: 3, kelompokPekerjaan: "Kelompok Pekerjaan 3", focusPoint: "KP 3", status: "Sebagian" },
          { no: 4, kelompokPekerjaan: "Kelompok Pekerjaan 4", focusPoint: "KP 4", status: "Terpenuhi" },
        ],
      },
    });

    expect(proposal.items.filter((i) => i.kpIndex === 1).every((i) => i.achieved === true)).toBe(true);
    expect(proposal.items.filter((i) => i.kpIndex === 2).every((i) => i.achieved === false)).toBe(true);
    expect(proposal.items.filter((i) => i.kpIndex === 3).every((i) => i.achieved === null)).toBe(true);
    expect(proposal.items.filter((i) => i.kpIndex === 4).every((i) => i.achieved === true)).toBe(true);
  });

  it("distinguishes worker metadata from saved assessor decisions in official_04b", () => {
    const metadataOnly = extractOfficial04bAssessment({
      official_04b: {
        officialQuestionCount: 13,
        decisionRule: "VATM",
      },
    });
    expect(hasSavedOfficial04bAssessment(metadataOnly)).toBe(false);

    const saved = extractOfficial04bAssessment({
      official_04b: {
        items: [{ kpIndex: 1, no: 1, unitCode: "M.71KKK01.001.1", achieved: true }],
        overallRecommendation: "K",
        assessedBy: "user-1",
        assessedAt: "2026-11-25T09:00:00.000Z",
      },
    });
    expect(hasSavedOfficial04bAssessment(saved)).toBe(true);
  });

  it("keeps buildIa04bPayload neutral until saved, and preserves saved decisions even if coverageMatrix updates", () => {
    const unsavedPayload = buildIa04bPayload({
      schemeTitle: "AK3U",
      schemeNumber: "SKM/1",
      assessorName: "Asesor",
      assessorRegNo: "MET.1",
      assesseeName: "Asesi",
      assessmentDate: "2026-11-25",
      decisions: [],
      ditAnalysis: {
        coverage_matrix: Array.from({ length: 13 }).map((_, idx) => ({
          no: idx + 1,
          status: "Terpenuhi",
        })),
        readiness: { recommendation: "Kompeten" },
        official_04b: { officialQuestionCount: 13, decisionRule: "VATM" },
      },
    });
    expect(unsavedPayload.itemAchievedFlags.every((f) => f === null)).toBe(true);
    expect(unsavedPayload.overallRecommendation).toBeNull();

    const savedPayload = buildIa04bPayload({
      schemeTitle: "AK3U",
      schemeNumber: "SKM/1",
      assessorName: "Asesor",
      assessorRegNo: "MET.1",
      assesseeName: "Asesi",
      assessmentDate: "2026-11-25",
      decisions: [],
      ditAnalysis: {
        coverage_matrix: Array.from({ length: 13 }).map((_, idx) => ({
          no: idx + 1,
          status: "Terpenuhi",
        })),
        readiness: { recommendation: "Kompeten" },
        official_04b: {
          items: Array.from({ length: 13 }).map((_, idx) => ({
            kpIndex: 1,
            no: idx + 1,
            unitCode: "",
            achieved: idx === 0 ? false : true,
          })),
          overallRecommendation: "BK",
          assessedBy: "user-1",
          assessedAt: "2026-11-25T09:00:00.000Z",
        },
      },
    });
    expect(savedPayload.itemAchievedFlags[0]).toBe(false);
    expect(savedPayload.itemAchievedFlags[1]).toBe(true);
    expect(savedPayload.overallRecommendation).toBe("BK");
  });
});
