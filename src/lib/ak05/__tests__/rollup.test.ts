import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { computeAk05RowForAssessee, resolveAssesseeOverallDecision } from "../rollup";
import { generateAk05Docx, generateAk05Pdf } from "@/services/export";

describe("AK.05 Decision Roll-up (T4 / Cacat 2)", () => {
  it("marks assessee with zero unit decisions as undecided ('-' / 'Belum diputuskan'), never 'K'", () => {
    const row = computeAk05RowForAssessee({
      no: 1,
      assessee: {
        id: "as-1",
        displayName: "Budi Santoso",
        certificateNameConfirmed: "Budi Santoso",
      },
      unitDecisions: [],
    });

    expect(row.recommendation).toBe("-");
    expect(row.keterangan).toBe("Belum diputuskan");
    expect(row.undecided).toBe(true);
  });

  it("rolls up any BK unit decision to 'BK' and lists BK unit codes/titles in keterangan", () => {
    const row = computeAk05RowForAssessee({
      no: 2,
      assessee: {
        id: "as-2",
        displayName: "Siti Aminah",
        certificateNameConfirmed: "Siti Aminah",
      },
      unitDecisions: [
        { unitCode: "M.71KKK01.001.1", unitTitle: "Identifikasi Risiko", decision: "K" },
        { unitCode: "M.71KKK01.005.1", unitTitle: "Pengukuran Bahaya", decision: "BK" },
      ],
    });

    expect(row.recommendation).toBe("BK");
    expect(row.keterangan).toContain("M.71KKK01.005.1");
    expect(row.keterangan).toContain("Pengukuran Bahaya");
    expect(row.undecided).toBe(false);
  });

  it("rolls up to 'K' only when unit decisions exist and none are BK", () => {
    const row = computeAk05RowForAssessee({
      no: 3,
      assessee: {
        id: "as-3",
        displayName: "Andi Wijaya",
        certificateNameConfirmed: null,
      },
      unitDecisions: [
        { unitCode: "M.71KKK01.001.1", unitTitle: "Identifikasi Risiko", decision: "K" },
      ],
    });

    expect(row.recommendation).toBe("K");
    expect(row.keterangan).toBe("");
    expect(row.undecided).toBe(false);
  });

  it("renders BK and undecided rows faithfully in exported DOCX and PDF without defaulting undecided to K", async () => {
    const rows = [
      computeAk05RowForAssessee({
        no: 1,
        assessee: { id: "a1", displayName: "Peserta BK", certificateNameConfirmed: "Peserta BK" },
        unitDecisions: [{ unitCode: "M.71KKK01.002.1", unitTitle: "Tanggap Darurat", decision: "BK" }],
      }),
      computeAk05RowForAssessee({
        no: 2,
        assessee: { id: "a2", displayName: "Peserta Belum", certificateNameConfirmed: "Peserta Belum" },
        unitDecisions: [],
      }),
    ];

    const payload = {
      schemeCode: "AK3U",
      schemeTitle: "Ahli Keselamatan dan Kesehatan Kerja Umum",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu" as const,
      assessorName: "Asesor Uji",
      assessorRegNo: "MET.000.001.2026",
      assessmentDate: "2026-11-18",
      rows,
      notesPositiveNegative: "-",
      notesRejection: "-",
      notesImprovement: "-",
    };

    const docxBuf = await generateAk05Docx(payload);
    const zip = await JSZip.loadAsync(docxBuf);
    const docXml = await zip.file("word/document.xml")!.async("string");
    expect(docXml).toContain("Peserta BK");
    expect(docXml).toContain("M.71KKK01.002.1 (Tanggap Darurat)");
    expect(docXml).toContain("Peserta Belum");
    expect(docXml).toContain("Belum diputuskan");

    const pdfBuf = await generateAk05Pdf(payload);
    expect(pdfBuf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("keeps partial K decisions undecided until all scheme units are decided, unless BK occurs", () => {
    const partialK = computeAk05RowForAssessee({
      no: 4,
      assessee: { id: "a4", displayName: "Citra", certificateNameConfirmed: "Citra" },
      totalSchemeUnits: 13,
      unitDecisions: [
        { unitCode: "M.71KKK01.001.1", unitTitle: "Identifikasi Risiko", decision: "K" },
        { unitCode: "M.71KKK01.002.1", unitTitle: "Tanggap Darurat", decision: null },
      ],
    });
    expect(partialK.recommendation).toBe("-");
    expect(partialK.undecided).toBe(true);
    expect(partialK.keterangan).toContain("Belum diputuskan (1/13 unit K)");

    // Even ONE BK unit out of 13 immediately resolves AK.05 to BK!
    const singleBkAmongPartial = computeAk05RowForAssessee({
      no: 5,
      assessee: { id: "a5", displayName: "Dani", certificateNameConfirmed: "Dani" },
      totalSchemeUnits: 13,
      unitDecisions: [
        { unitCode: "M.71KKK01.001.1", unitTitle: "Identifikasi Risiko", decision: "K" },
        { unitCode: "M.71KKK01.002.1", unitTitle: "Tanggap Darurat", decision: "BK" },
      ],
    });
    expect(singleBkAmongPartial.recommendation).toBe("BK");
    expect(singleBkAmongPartial.undecided).toBe(false);
    expect(singleBkAmongPartial.keterangan).toContain("M.71KKK01.002.1");
  });

  it("allows authorized manual assessor override as final call (K over BK, or BK over K, or clear)", () => {
    const unitDecisions = [
      { unitCode: "M.71KKK01.001.1", unitTitle: "Identifikasi Risiko", decision: "K" },
      { unitCode: "M.71KKK01.002.1", unitTitle: "Tanggap Darurat", decision: "BK" },
    ];

    const manualK = resolveAssesseeOverallDecision({
      unitDecisions,
      totalSchemeUnits: 13,
      manualOverride: {
        overrideDecision: "K",
        overrideReason: "Asesor memverifikasi bukti susulan memenuhi seluruh KUK",
      },
    });
    expect(manualK.autoRecommendation).toBe("BK");
    expect(manualK.recommendation).toBe("K");
    expect(manualK.isOverridden).toBe(true);
    expect(manualK.source).toBe("manual_override");
    expect(manualK.keterangan).toContain("Keputusan Manual Asesor");

    const row = computeAk05RowForAssessee({
      no: 6,
      assessee: { id: "a6", displayName: "Eko", certificateNameConfirmed: "Eko" },
      unitDecisions,
      totalSchemeUnits: 13,
      manualOverride: {
        overrideDecision: "K",
        overrideReason: "Verifikasi final asesor menyatakan kompeten",
      },
    });
    expect(row.recommendation).toBe("K");
    expect(row.decisionSource).toBe("manual_override");
    expect(row.autoRecommendation).toBe("BK");

    // Clearing override reverts immediately back to automatic BK rule
    const reverted = resolveAssesseeOverallDecision({
      unitDecisions,
      totalSchemeUnits: 13,
      manualOverride: {
        overrideDecision: null,
        overrideReason: "Dikembalikan ke roll-up otomatis",
      },
    });
    expect(reverted.recommendation).toBe("BK");
    expect(reverted.isOverridden).toBe(false);
    expect(reverted.source).toBe("auto_rollup");
  });
});
