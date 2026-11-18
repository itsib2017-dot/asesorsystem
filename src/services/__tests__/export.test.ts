import { describe, it, expect } from "vitest";
import JSZip from "jszip";
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
    expect(mediaFiles.length).toBeGreaterThan(0);

    const pdfWithSig = await generateAk05Pdf(payload);
    const pdfWithoutSig = await generateAk05Pdf({ ...payload, signaturePngBytes: undefined });
    expect(pdfWithSig.length).toBeGreaterThan(pdfWithoutSig.length);
  });
});
