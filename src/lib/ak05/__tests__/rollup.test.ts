import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { computeAk05RowForAssessee } from "../rollup";
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
});
