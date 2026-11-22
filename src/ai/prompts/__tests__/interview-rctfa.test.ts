import { describe, expect, it } from "vitest";
import { buildDitGapAnalysisPrompt } from "../dit-gap-analysis.v1";
import { buildInterviewPrompt } from "../interview-rctfa.v1";

describe("interview & DIT RCTFA prompts (Moza alignment)", () => {
  const base = {
    pseudonym: "ASESI-007",
    lspName: "LSP TIK Nusantara",
    schemeName: "Okupasi ICT Project Manager",
    schemeCode: "ICT-PM",
    questionCount: 5,
    units: [{ code: "J.620900.001.02", title: "Menyusun Perencanaan Proyek TIK" }],
    legalRefs: ["SKKNI 2014-349"],
    candidateProfileSummary: "NIK 1234567812345678, pengalaman 5 tahun sebagai project manager.",
  };

  it("is scheme- and tenant-agnostic and embeds Moza RCTFA rules", () => {
    const prompt = buildInterviewPrompt(base);
    expect(prompt).toContain("ICT-PM");
    expect(prompt).toContain("LSP TIK Nusantara");
    expect(prompt).toContain("TEPAT 5 pertanyaan");
    expect(prompt).toContain("Manajerial/Profesional");
    expect(prompt).toContain("Lulusan Baru");
    expect(prompt).toContain("Transisi");
    expect(prompt).toContain("Operator");
    expect(prompt).toContain("non-metro");
    expect(prompt).toContain("TS");
    expect(prompt).toContain("TMS");
    expect(prompt).toContain("CMS");
    expect(prompt).toContain("JRES");
    expect(prompt).toContain("TrS");
    expect(prompt).toContain("STAR");
    expect(prompt).toContain("tunda kesimpulan");
    expect(prompt).not.toMatch(/AK3U|Keselamatan dan Kesehatan Kerja|zro\.moonmath/);
  });

  it("aligns DIT gap analysis prompt with Moza RCTFA role/region/material rules", () => {
    const prompt = buildDitGapAnalysisPrompt({
      pseudonym: "ASESI-007",
      schemeName: "Okupasi ICT Project Manager",
      questionCount: 7,
      legalRefs: ["SKKNI 2014-349"],
      frIa04aText: "Instruksi presentasi proyek TIK.",
      presentationTranscript: "Kandidat memaparkan mitigasi risiko proyek daerah.",
      candidateProfileSummary: "Pengalaman 4 tahun di perusahaan daerah non-metro.",
    });

    expect(prompt).toContain("TEPAT 7 butir");
    expect(prompt).toContain("Manajerial / Profesional");
    expect(prompt).toContain("non-metro vs metro");
    expect(prompt).toContain("[TS]");
    expect(prompt).toContain("[TrS]");
    expect(prompt).toContain("STAR");
    expect(prompt).not.toContain("Kompeten Bersyarat");
  });

  it("redacts PII from untrusted candidate material", () => {
    const prompt = buildInterviewPrompt(base);
    expect(prompt).not.toContain("1234567812345678");
  });
});
