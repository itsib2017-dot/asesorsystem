import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ExcelJS from "exceljs";

export type DocumentType = "ak05" | "ak02" | "ia04b" | "ia06" | "dit_pack" | "similarity";
export type ExportFormat = "pdf" | "docx" | "xlsx";

/**
 * Enforces Export Rule D8:
 * - AK.05: PDF + DOCX
 * - Other documents (ak02, ia04b, ia06, dit_pack, similarity): DOCX only
 * - Tabular data extracts (completeness_matrix, audit_log): XLSX only
 */
export function validateExportFormat(
  docType: DocumentType | "completeness_matrix" | "audit_log",
  format: ExportFormat,
): { allowed: true } | { allowed: false; reason: string } {
  if (docType === "completeness_matrix" || docType === "audit_log") {
    if (format === "xlsx") return { allowed: true };
    return {
      allowed: false,
      reason: `Format '${format}' tidak diizinkan untuk ekstrak data '${docType}'. Hanya XLSX yang diizinkan.`,
    };
  }

  if (docType === "ak05") {
    if (format === "pdf" || format === "docx") return { allowed: true };
    return {
      allowed: false,
      reason: `Format '${format}' tidak diizinkan untuk FR.AK.05. Hanya PDF atau DOCX yang diizinkan.`,
    };
  }

  if (format === "docx") return { allowed: true };
  return {
    allowed: false,
    reason: `Format '${format}' dilarang oleh aturan D8 untuk dokumen '${docType}'. Hanya DOCX yang diizinkan (PDF hanya untuk FR.AK.05).`,
  };
}

export interface Ak05ExportPayload {
  schemeCode: string;
  schemeTitle: string;
  schemeNumber: string;
  tukType: "sewaktu" | "tempat_kerja" | "mandiri";
  assessorName: string;
  assessorRegNo: string;
  assessmentDate: string;
  rows: Array<{
    no: number;
    assesseeName: string;
    recommendation: "K" | "BK";
    keterangan: string;
  }>;
  notesPositiveNegative: string;
  notesRejection: string;
  notesImprovement: string;
  signaturePngBytes?: Buffer;
}

export async function generateAk05Docx(payload: Ak05ExportPayload): Promise<Buffer> {
  const tableRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No.", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nama Asesi", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Rekomendasi (K / BK)", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Keterangan**", bold: true })] })] }),
      ],
    }),
    ...payload.rows.map(
      (r) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(r.no))] }),
            new TableCell({ children: [new Paragraph(r.assesseeName)] }),
            new TableCell({ children: [new Paragraph(r.recommendation)] }),
            new TableCell({ children: [new Paragraph(r.keterangan || "-")] }),
          ],
        }),
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "FR.AK.05. LAPORAN ASESMEN", bold: true, size: 28 })],
          }),
          new Paragraph(`Skema Sertifikasi: ${payload.schemeTitle} (${payload.schemeNumber})`),
          new Paragraph(`TUK: ${payload.tukType.toUpperCase()} | Tanggal: ${payload.assessmentDate}`),
          new Paragraph(`Asesor: ${payload.assessorName} | No. Reg: ${payload.assessorRegNo}`),
          new Paragraph(""),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
          new Paragraph(""),
          new Paragraph({
            children: [
              new TextRun({
                text: "**Tuliskan Kode dan Judul Unit Kompetensi yang dinyatakan BK",
                italics: true,
                size: 18,
              }),
            ],
          }),
          new Paragraph(""),
          new Paragraph({ children: [new TextRun({ text: "Aspek Negatif dan Positif dalam Asesmen:", bold: true })] }),
          new Paragraph(payload.notesPositiveNegative || "-"),
          new Paragraph({ children: [new TextRun({ text: "Pencatatan Penolakan Hasil Asesmen:", bold: true })] }),
          new Paragraph(payload.notesRejection || "-"),
          new Paragraph({ children: [new TextRun({ text: "Saran Perbaikan (Asesor/Personil Terkait):", bold: true })] }),
          new Paragraph(payload.notesImprovement || "-"),
          new Paragraph(""),
          new Paragraph(`Tanda Tangan Asesor: ${payload.assessorName} (${payload.assessorRegNo}) — ${payload.assessmentDate}`),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function generateAk05Pdf(payload: Ak05ExportPayload): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = 790;
  page.drawText("FR.AK.05. LAPORAN ASESMEN", {
    x: 45,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.2),
  });
  y -= 22;

  page.drawText(`Skema: ${payload.schemeTitle} (${payload.schemeNumber})`, {
    x: 45,
    y,
    size: 10,
    font: fontRegular,
  });
  y -= 16;
  page.drawText(`TUK: ${payload.tukType.toUpperCase()} | Tanggal: ${payload.assessmentDate}`, {
    x: 45,
    y,
    size: 10,
    font: fontRegular,
  });
  y -= 16;
  page.drawText(`Asesor: ${payload.assessorName} | No. Reg: ${payload.assessorRegNo}`, {
    x: 45,
    y,
    size: 10,
    font: fontRegular,
  });
  y -= 26;

  page.drawText("No | Nama Asesi | Rekomendasi | Keterangan**", {
    x: 45,
    y,
    size: 10,
    font: fontBold,
  });
  y -= 16;

  for (const row of payload.rows.slice(0, 15)) {
    page.drawText(
      `${row.no}. ${row.assesseeName.slice(0, 32)} | ${row.recommendation} | ${(row.keterangan || "-").slice(0, 30)}`,
      { x: 45, y, size: 9, font: fontRegular },
    );
    y -= 15;
  }

  y -= 10;
  page.drawText("**Tuliskan Kode dan Judul Unit Kompetensi yang dinyatakan BK", {
    x: 45,
    y,
    size: 8,
    font: fontRegular,
  });
  y -= 24;
  page.drawText(`Aspek Positif/Negatif: ${(payload.notesPositiveNegative || "-").slice(0, 80)}`, {
    x: 45,
    y,
    size: 9,
    font: fontRegular,
  });
  y -= 16;
  page.drawText(`Penolakan: ${(payload.notesRejection || "-").slice(0, 80)}`, {
    x: 45,
    y,
    size: 9,
    font: fontRegular,
  });
  y -= 16;
  page.drawText(`Saran Perbaikan: ${(payload.notesImprovement || "-").slice(0, 80)}`, {
    x: 45,
    y,
    size: 9,
    font: fontRegular,
  });

  if (payload.signaturePngBytes) {
    try {
      const pngImage = await pdfDoc.embedPng(payload.signaturePngBytes);
      page.drawImage(pngImage, { x: 420, y: 70, width: 110, height: 45 });
    } catch {
      // Fallback safely if signature image is JPEG or invalid
    }
  }

  page.drawText(`Asesor: ${payload.assessorName}`, { x: 420, y: 55, size: 9, font: fontBold });
  page.drawText(`Reg: ${payload.assessorRegNo}`, { x: 420, y: 42, size: 8, font: fontRegular });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function generateTabularXlsx(
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(sheetName);
  sheet.addRow(headers);
  for (const r of rows) {
    sheet.addRow(r);
  }
  const arrBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrBuf);
}
