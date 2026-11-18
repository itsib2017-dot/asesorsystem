import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import {
  validateExportFormat,
  generateAk05Docx,
  generateAk05Pdf,
  generateTabularXlsx,
} from "../export";

// 1x1 transparent PNG
const SAMPLE_PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

describe("Export Format Rule D8 & Document Generators", () => {
  it("allows PDF and DOCX for AK.05, and blocks PDF for all other documents", () => {
    expect(validateExportFormat("ak05", "pdf").allowed).toBe(true);
    expect(validateExportFormat("ak05", "docx").allowed).toBe(true);
    expect(validateExportFormat("ak05", "xlsx").allowed).toBe(false);

    expect(validateExportFormat("ak02", "docx").allowed).toBe(true);
    expect(validateExportFormat("ak02", "pdf").allowed).toBe(false);
    expect(validateExportFormat("ia04b", "pdf").allowed).toBe(false);
    expect(validateExportFormat("ia06", "pdf").allowed).toBe(false);

    expect(validateExportFormat("audit_log", "xlsx").allowed).toBe(true);
    expect(validateExportFormat("audit_log", "pdf").allowed).toBe(false);
  });

  it("generates valid PDF, DOCX, and XLSX buffers for FR.AK.05", async () => {
    const payload = {
      schemeCode: "AK3U",
      schemeTitle: "Ahli K3 Umum",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu" as const,
      assessorName: "Asesor Uji",
      assessorRegNo: "MET.000.001.2026",
      assessmentDate: "2026-11-18",
      rows: [
        { no: 1, assesseeName: "Budi Santoso", recommendation: "K" as const, keterangan: "" },
      ],
      notesPositiveNegative: "Berjalan baik",
      notesRejection: "-",
      notesImprovement: "-",
    };

    const pdfBuf = await generateAk05Pdf(payload);
    expect(pdfBuf.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const docxBuf = await generateAk05Docx(payload);
    expect(docxBuf.subarray(0, 2).toString("utf8")).toBe("PK");

    const xlsxBuf = await generateTabularXlsx("Audit", ["Col1"], [["Val1"]]);
    expect(xlsxBuf.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("embeds signature image bytes in both FR.AK.05 DOCX and PDF", async () => {
    const payload = {
      schemeCode: "AK3U",
      schemeTitle: "Ahli K3 Umum",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukName: "TUK Mairodi",
      tukType: "sewaktu" as const,
      assessorName: "Asesor Uji",
      assessorRegNo: "MET.000.001.2026",
      assessmentDate: "2026-11-18",
      rows: [
        { no: 1, assesseeName: "Zaenudin", recommendation: "K" as const, keterangan: "" },
      ],
      notesPositiveNegative: "-",
      notesRejection: "-",
      notesImprovement: "-",
      signaturePngBytes: SAMPLE_PNG_1X1,
      signatureMimeType: "image/png" as const,
    };

    const docxBuf = await generateAk05Docx(payload);
    const zip = await JSZip.loadAsync(docxBuf);
    const mediaFiles = Object.keys(zip.files).filter((k) => k.startsWith("word/media/"));
    expect(mediaFiles).toContain("word/media/signature.png");

    const docXml = await zip.file("word/document.xml")!.async("string");
    const relsXml = await zip.file("word/_rels/document.xml.rels")!.async("string");
    expect(relsXml).toContain("rIdSig1");
    expect(docXml).toContain("rIdSig1");
    expect(docXml).toContain("TUK Mairodi");
    expect(docXml).toContain("SKM/2037/00013/2/2021/1");
    expect(docXml).toContain("Zaenudin");
    expect(docxBuf.length).toBeGreaterThan(500_000);

    // Ensure all 5 blanko tables remain intact
    const tblCount = (docXml.match(/<w:tbl\b/g) ?? []).length;
    expect(tblCount).toBe(5);

    const pdfWithSig = await generateAk05Pdf(payload);
    const pdfWithoutSig = await generateAk05Pdf({ ...payload, signaturePngBytes: undefined });
    expect(pdfWithSig.length).toBeGreaterThan(pdfWithoutSig.length);

    const parsedPdf = await PDFDocument.load(pdfWithSig);
    expect(parsedPdf.getPageCount()).toBe(2);
  });

  it("handles >12 candidates by cloning rows cleanly in template-filled DOCX", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      no: i + 1,
      assesseeName: `Peserta Uji ${i + 1}`,
      recommendation: (i === 19 ? "BK" : "K") as "K" | "BK",
      keterangan: i === 19 ? "K3.001" : "",
    }));

    const docxBuf = await generateAk05Docx({
      schemeCode: "AK3U",
      schemeTitle: "Ahli Keselamatan dan Kesehatan Kerja Umum",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukName: "TUK Demo",
      tukType: "mandiri",
      assessorName: "Asesor Uji",
      assessorRegNo: "MET.000.001.2026",
      assessmentDate: "2026-11-18",
      rows,
      notesPositiveNegative: "Lancar",
      notesRejection: "-",
      notesImprovement: "-",
    });

    const zip = await JSZip.loadAsync(docxBuf);
    const docXml = await zip.file("word/document.xml")!.async("string");
    expect(docXml).toContain("Peserta Uji 1");
    expect(docXml).toContain("Peserta Uji 20");
    expect(docXml).toContain("K3.001");
  });
});
