import {
  AlignmentType,
  Document,
  ImageRun,
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
  tukName?: string;
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
  signatureMimeType?: "image/png" | "image/jpeg";
}

function detectSignatureImageType(
  bytes: Buffer,
  mimeHint?: "image/png" | "image/jpeg",
): "png" | "jpg" {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  return mimeHint === "image/jpeg" ? "jpg" : "png";
}

function buildTukTextRuns(
  tukType: Ak05ExportPayload["tukType"],
  tukName?: string,
): TextRun[] {
  const runs: TextRun[] = [
    new TextRun({ text: "Sewaktu", strike: tukType !== "sewaktu" }),
    new TextRun({ text: " / " }),
    new TextRun({ text: "Tempat Kerja", strike: tukType !== "tempat_kerja" }),
    new TextRun({ text: " / " }),
    new TextRun({ text: "Mandiri*", strike: tukType !== "mandiri" }),
  ];
  if (tukName && tukName !== "-") {
    runs.push(new TextRun({ text: ` (${tukName})`, bold: true }));
  }
  return runs;
}

export async function generateAk05Docx(payload: Ak05ExportPayload): Promise<Buffer> {
  const minRows = Math.max(12, payload.rows.length);
  const candidateRows = Array.from({ length: minRows }).map((_, idx) => {
    const r = payload.rows[idx];
    const hasRow = Boolean(r);
    return new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${idx + 1}.` })],
            }),
          ],
        }),
        new TableCell({
          children: [new Paragraph(r?.assesseeName ?? "")],
        }),
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: hasRow ? (r?.recommendation === "K" ? "☑" : "☐") : "☐",
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: hasRow ? (r?.recommendation === "BK" ? "☑" : "☐") : "☐",
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          children: [new Paragraph(r?.keterangan ?? "")],
        }),
      ],
    });
  });

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Skema Sertifikasi", bold: true })],
              }),
              new Paragraph("(KKNI/Okupasi/Klaster)"),
            ],
          }),
          new TableCell({
            children: [new Paragraph("Judul")],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: payload.schemeTitle, bold: true })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph("")] }),
          new TableCell({ children: [new Paragraph("Nomor")] }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: payload.schemeNumber })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "TUK", bold: true })],
              }),
            ],
          }),
          new TableCell({
            columnSpan: 2,
            children: [
              new Paragraph({
                children: buildTukTextRuns(payload.tukType, payload.tukName),
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Nama Asesor", bold: true })],
              }),
            ],
          }),
          new TableCell({
            columnSpan: 2,
            children: [new Paragraph(payload.assessorName)],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Tanggal", bold: true })],
              }),
            ],
          }),
          new TableCell({
            columnSpan: 2,
            children: [new Paragraph(payload.assessmentDate)],
          }),
        ],
      }),
    ],
  });

  const tableRows = [
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "No.", bold: true })],
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Nama Asesi", bold: true })],
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "K", bold: true })],
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "BK", bold: true })],
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Keterangan**", bold: true })],
            }),
          ],
        }),
      ],
    }),
    ...candidateRows,
  ];

  const signatureContent: Array<TextRun | ImageRun> = [];
  if (payload.signaturePngBytes && payload.signaturePngBytes.length > 0) {
    signatureContent.push(
      new ImageRun({
        type: detectSignatureImageType(payload.signaturePngBytes, payload.signatureMimeType),
        data: payload.signaturePngBytes,
        transformation: { width: 110, height: 45 },
      }),
    );
  }
  signatureContent.push(
    new TextRun({
      text: `${payload.signaturePngBytes?.length ? "\n" : ""}${payload.assessmentDate}`,
    }),
  );

  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Asesor :", bold: true })],
              }),
            ],
          }),
          new TableCell({ children: [new Paragraph("Nama")] }),
          new TableCell({ children: [new Paragraph(payload.assessorName)] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph("")] }),
          new TableCell({ children: [new Paragraph("No. Reg")] }),
          new TableCell({ children: [new Paragraph(payload.assessorRegNo)] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph("")] }),
          new TableCell({ children: [new Paragraph("Tanda tangan & tanggal")] }),
          new TableCell({
            children: [
              new Paragraph({
                children: signatureContent,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "FR.AK.05. LAPORAN ASESMEN", bold: true, size: 28 })],
          }),
          new Paragraph(""),
          metaTable,
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
          new Paragraph({ children: [new TextRun({ text: "Saran Perbaikan : (Asesor/Personil Terkait):", bold: true })] }),
          new Paragraph(payload.notesImprovement || "-"),
          new Paragraph(""),
          signatureTable,
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

  page.drawText(`Skema Sertifikasi: ${payload.schemeTitle} (${payload.schemeNumber})`, {
    x: 45,
    y,
    size: 10,
    font: fontRegular,
  });
  y -= 16;
  const tukDisplay =
    payload.tukName && payload.tukName !== "-"
      ? `${payload.tukName} (${payload.tukType.toUpperCase()})`
      : payload.tukType.toUpperCase();
  page.drawText(`TUK: ${tukDisplay} | Tanggal: ${payload.assessmentDate}`, {
    x: 45,
    y,
    size: 10,
    font: fontRegular,
  });
  y -= 16;
  page.drawText(`Nama Asesor: ${payload.assessorName} | No. Reg: ${payload.assessorRegNo}`, {
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

  if (payload.signaturePngBytes && payload.signaturePngBytes.length > 0) {
    try {
      const kind = detectSignatureImageType(payload.signaturePngBytes, payload.signatureMimeType);
      const sigImage =
        kind === "jpg"
          ? await pdfDoc.embedJpg(payload.signaturePngBytes)
          : await pdfDoc.embedPng(payload.signaturePngBytes);
      page.drawImage(sigImage, { x: 420, y: 70, width: 110, height: 45 });
    } catch {
      // Fallback safely if signature image is corrupted
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
