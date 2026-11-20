import { describe, expect, it } from "vitest";
import { buildInterviewPrompt } from "../interview-rctfa.v1";

describe("interview RCTFA prompt", () => {
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

  it("is scheme- and tenant-agnostic", () => {
    const prompt = buildInterviewPrompt(base);
    expect(prompt).toContain("ICT-PM");
    expect(prompt).toContain("LSP TIK Nusantara");
    expect(prompt).toContain("TEPAT 5 pertanyaan");
    expect(prompt).not.toMatch(/AK3U|Keselamatan dan Kesehatan Kerja|zro\.moonmath/);
  });

  it("redacts PII from untrusted candidate material", () => {
    const prompt = buildInterviewPrompt(base);
    expect(prompt).not.toContain("1234567812345678");
  });
});
