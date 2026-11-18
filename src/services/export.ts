import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage, type PDFFont } from "pdf-lib";

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

const AK05_TEMPLATE_PATH = path.join(
  process.cwd(),
  "src",
  "templates",
  "ak3u",
  "FR.AK.05.LAPORAN_ASESMEN.docx",
);

function loadAk05TemplateBuffer(): Buffer {
  return fs.readFileSync(AK05_TEMPLATE_PATH);
}

function detectSignatureImageType(
  bytes: Buffer,
  mimeHint?: "image/png" | "image/jpeg",
): "png" | "jpg" {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  return mimeHint === "image/jpeg" ? "jpg" : "png";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface XmlSpan {
  start: number;
  end: number;
}

function isTagDelimiter(ch: string | undefined): boolean {
  return ch === ">" || ch === "/" || ch === " " || ch === "\t" || ch === "\r" || ch === "\n";
}

function findTopLevelTags(
  xml: string,
  tagName: string,
  rangeStart = 0,
  rangeEnd = xml.length,
): XmlSpan[] {
  const spans: XmlSpan[] = [];
  const openToken = `<${tagName}`;
  const closeToken = `</${tagName}>`;

  let depth = 0;
  let currentStart = -1;
  let pos = rangeStart;

  while (pos < rangeEnd) {
    const nextOpen = xml.indexOf(openToken, pos);
    const nextClose = xml.indexOf(closeToken, pos);

    if (nextOpen === -1 && nextClose === -1) break;

    if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose) && nextOpen < rangeEnd) {
      const afterName = xml[nextOpen + openToken.length];
      if (!isTagDelimiter(afterName)) {
        pos = nextOpen + openToken.length;
        continue;
      }
      const tagEnd = xml.indexOf(">", nextOpen);
      if (tagEnd === -1) break;
      const isSelfClosing = xml[tagEnd - 1] === "/";
      if (depth === 0) {
        currentStart = nextOpen;
      }
      if (isSelfClosing) {
        if (depth === 0) {
          spans.push({ start: currentStart, end: tagEnd + 1 });
          currentStart = -1;
        }
      } else {
        depth += 1;
      }
      pos = tagEnd + 1;
    } else if (nextClose !== -1 && nextClose < rangeEnd) {
      const closeEnd = nextClose + closeToken.length;
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && currentStart !== -1) {
          spans.push({ start: currentStart, end: closeEnd });
          currentStart = -1;
        }
      }
      pos = closeEnd;
    } else {
      break;
    }
  }

  return spans;
}

function makeTextRun(
  text: string,
  opts?: { bold?: boolean; strike?: boolean; sizeHalfPt?: number },
): string {
  const sz = opts?.sizeHalfPt ?? 22;
  const boldXml = opts?.bold ? "<w:b/>" : "";
  const strikeXml = opts?.strike ? "<w:strike/>" : "";
  return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${boldXml}${strikeXml}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function replaceCellRuns(cellXml: string, runsXml: string): string {
  const closeCellIdx = cellXml.lastIndexOf("</w:tc>");
  if (closeCellIdx === -1) return cellXml;

  let pStart = -1;
  let searchPos = 0;
  while (searchPos < closeCellIdx) {
    const idx = cellXml.indexOf("<w:p", searchPos);
    if (idx === -1 || idx >= closeCellIdx) break;
    if (isTagDelimiter(cellXml[idx + 4])) {
      pStart = idx;
      break;
    }
    searchPos = idx + 4;
  }

  if (pStart === -1) {
    return `${cellXml.slice(0, closeCellIdx)}<w:p>${runsXml}</w:p></w:tc>`;
  }

  const tcPrefix = cellXml.slice(0, pStart);
  const openTagEnd = cellXml.indexOf(">", pStart);
  if (openTagEnd === -1) return cellXml;

  let pOpen = cellXml.slice(pStart, openTagEnd + 1);
  if (pOpen.endsWith("/>")) {
    pOpen = `${pOpen.slice(0, -2)}>`;
    return `${tcPrefix}${pOpen}${runsXml}</w:p></w:tc>`;
  }

  const firstPClose = cellXml.indexOf("</w:p>", openTagEnd + 1);
  let pPr = "";
  const pBodyEnd = firstPClose !== -1 && firstPClose < closeCellIdx ? firstPClose : closeCellIdx;
  const pPrStart = cellXml.indexOf("<w:pPr>", openTagEnd + 1);
  if (pPrStart !== -1 && pPrStart < pBodyEnd) {
    const pPrEnd = cellXml.indexOf("</w:pPr>", pPrStart);
    if (pPrEnd !== -1 && pPrEnd < pBodyEnd) {
      pPr = cellXml.slice(pPrStart, pPrEnd + "</w:pPr>".length);
    }
  }

  return `${tcPrefix}${pOpen}${pPr}${runsXml}</w:p></w:tc>`;
}

function mutateRowCells(
  rowXml: string,
  cellMutator: (cellXml: string, cellIndex: number) => string,
): string {
  const cellSpans = findTopLevelTags(rowXml, "w:tc");
  let result = rowXml;
  for (let i = cellSpans.length - 1; i >= 0; i--) {
    const span = cellSpans[i];
    if (!span) continue;
    const orig = rowXml.slice(span.start, span.end);
    const updated = cellMutator(orig, i);
    if (updated !== orig) {
      result = result.slice(0, span.start) + updated + result.slice(span.end);
    }
  }
  return result;
}

function mutateTableRows(
  tableXml: string,
  mutator: (rows: string[]) => string[],
): string {
  const rowSpans = findTopLevelTags(tableXml, "w:tr");
  if (rowSpans.length === 0) return tableXml;
  const firstRow = rowSpans[0];
  const lastRow = rowSpans[rowSpans.length - 1];
  if (!firstRow || !lastRow) return tableXml;

  const origRows = rowSpans.map((s) => tableXml.slice(s.start, s.end));
  const nextRows = mutator(origRows);
  return tableXml.slice(0, firstRow.start) + nextRows.join("") + tableXml.slice(lastRow.end);
}

function buildTukCellRuns(
  tukType: Ak05ExportPayload["tukType"],
  tukName?: string,
): string {
  const parts = [
    makeTextRun("Sewaktu", { strike: tukType !== "sewaktu" }),
    makeTextRun("/"),
    makeTextRun("Tempat Kerja", { strike: tukType !== "tempat_kerja" }),
    makeTextRun("/"),
    makeTextRun("Mandiri*", { strike: tukType !== "mandiri" }),
  ];
  if (tukName && tukName.trim() && tukName.trim() !== "-") {
    parts.push(makeTextRun(` (${tukName.trim()})`, { bold: true }));
  }
  return parts.join("");
}

function buildSignatureDrawingRun(relId: string, imageName: string): string {
  // 100 x 45 pt in EMU (1 pt = 12700 EMU) -> 1270000 x 571500, sized conservatively 952500 x 428625
  return (
    `<w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="952500" cy="428625"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="9001" name="AssessorSignature"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="9001" name="${escapeXml(imageName)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${escapeXml(relId)}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="428625"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic>` +
    `</wp:inline></w:drawing></w:r>`
  );
}

/**
 * Generates FR.AK.05 DOCX by surgically template-filling the official BNSP blanko
 * (`src/templates/ak3u/FR.AK.05.LAPORAN_ASESMEN.docx`) without altering its 5 tables,
 * headers, footers, or styles.
 */
export async function generateAk05Docx(payload: Ak05ExportPayload): Promise<Buffer> {
  const zip = await JSZip.loadAsync(loadAk05TemplateBuffer());
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("TEMPLATE_ERROR: word/document.xml tidak ditemukan di blanko FR.AK.05.");
  }

  const docXml = await docFile.async("string");
  const tableSpans = findTopLevelTags(docXml, "w:tbl");
  if (tableSpans.length < 5) {
    throw new Error(
      `TEMPLATE_ERROR: Blanko FR.AK.05 tidak valid (ditemukan ${tableSpans.length} tabel, diharapkan 5).`,
    );
  }

  let hasEmbeddedSig = false;
  let sigExt: "png" | "jpg" = "png";
  if (payload.signaturePngBytes && payload.signaturePngBytes.length > 0) {
    sigExt = detectSignatureImageType(payload.signaturePngBytes, payload.signatureMimeType);
    zip.file(`word/media/signature.${sigExt}`, payload.signaturePngBytes);

    const relsFile = zip.file("word/_rels/document.xml.rels");
    if (relsFile) {
      let relsXml = await relsFile.async("string");
      if (!relsXml.includes('Id="rIdSig1"')) {
        relsXml = relsXml.replace(
          "</Relationships>",
          `<Relationship Id="rIdSig1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.${sigExt}"/></Relationships>`,
        );
        zip.file("word/_rels/document.xml.rels", relsXml);
      }
    }

    if (sigExt === "jpg") {
      const ctFile = zip.file("[Content_Types].xml");
      if (ctFile) {
        let ctXml = await ctFile.async("string");
        if (!ctXml.includes('Extension="jpg"')) {
          ctXml = ctXml.replace(
            "</Types>",
            `<Default Extension="jpg" ContentType="image/jpeg"/></Types>`,
          );
          zip.file("[Content_Types].xml", ctXml);
        }
      }
    }

    hasEmbeddedSig = true;
  }

  // Table 1: Metadata (Judul, Nomor, TUK, Nama Asesor, Tanggal)
  const t1Span = tableSpans[1]!;
  const updatedT1 = mutateTableRows(docXml.slice(t1Span.start, t1Span.end), (rows) =>
    rows.map((rowXml, rIdx) => {
      if (rIdx === 0) {
        const title = payload.schemeTitle.trim();
        if (!title || title.toLowerCase() === "ahli keselamatan dan kesehatan kerja umum") {
          return rowXml;
        }
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 3 ? replaceCellRuns(cXml, makeTextRun(title, { bold: true })) : cXml,
        );
      }
      if (rIdx === 1) {
        const num = payload.schemeNumber.trim();
        if (!num || num === "-" || num.toUpperCase() === "SKM/2037/00013/2/2021/1") {
          return rowXml;
        }
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 3 ? replaceCellRuns(cXml, makeTextRun(num, { bold: true })) : cXml,
        );
      }
      if (rIdx === 2) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, buildTukCellRuns(payload.tukType, payload.tukName)) : cXml,
        );
      }
      if (rIdx === 3) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(payload.assessorName)) : cXml,
        );
      }
      if (rIdx === 4) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(payload.assessmentDate)) : cXml,
        );
      }
      return rowXml;
    }),
  );

  // Table 2: Candidate rows (R0 & R1 headers untouched, R2..R13 + extra cloned if >12 candidates)
  const t2Span = tableSpans[2]!;
  const updatedT2 = mutateTableRows(docXml.slice(t2Span.start, t2Span.end), (rows) => {
    const headerRows = rows.slice(0, 2);
    const bodyTemplates = rows.slice(2);
    const cloneSource = (bodyTemplates[bodyTemplates.length - 1] ?? "").replace(
      /\s+w14:(?:paraId|textId)="[^"]*"/g,
      "",
    );
    const totalCandidates = Math.max(bodyTemplates.length, payload.rows.length);

    const filledBodyRows: string[] = [];
    for (let idx = 0; idx < totalCandidates; idx++) {
      const tplRow = bodyTemplates[idx] ?? cloneSource;
      const cand = payload.rows[idx];
      const filled = mutateRowCells(tplRow, (cXml, cIdx) => {
        if (cIdx === 0) return replaceCellRuns(cXml, makeTextRun(`${idx + 1}.`));
        if (cIdx === 1) return replaceCellRuns(cXml, makeTextRun(cand?.assesseeName ?? ""));
        if (cIdx === 2) {
          return replaceCellRuns(
            cXml,
            makeTextRun(cand ? (cand.recommendation === "K" ? "☑" : "☐") : ""),
          );
        }
        if (cIdx === 3) {
          return replaceCellRuns(
            cXml,
            makeTextRun(cand ? (cand.recommendation === "BK" ? "☑" : "☐") : ""),
          );
        }
        if (cIdx === 4) return replaceCellRuns(cXml, makeTextRun(cand?.keterangan ?? ""));
        return cXml;
      });
      filledBodyRows.push(filled);
    }

    return [...headerRows, ...filledBodyRows];
  });

  // Table 3: Qualitative notes
  const t3Span = tableSpans[3]!;
  const updatedT3 = mutateTableRows(docXml.slice(t3Span.start, t3Span.end), (rows) =>
    rows.map((rowXml, rIdx) => {
      const noteValue =
        rIdx === 0
          ? payload.notesPositiveNegative || "-"
          : rIdx === 1
            ? payload.notesRejection || "-"
            : payload.notesImprovement || "-";
      return mutateRowCells(rowXml, (cXml, cIdx) =>
        cIdx === 1 ? replaceCellRuns(cXml, makeTextRun(noteValue)) : cXml,
      );
    }),
  );

  // Table 4: Assessor signature & date block
  const t4Span = tableSpans[4]!;
  const updatedT4 = mutateTableRows(docXml.slice(t4Span.start, t4Span.end), (rows) =>
    rows.map((rowXml, rIdx) => {
      if (rIdx === 1) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(payload.assessorName)) : cXml,
        );
      }
      if (rIdx === 2) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(payload.assessorRegNo)) : cXml,
        );
      }
      if (rIdx === 3) {
        const sigRuns = hasEmbeddedSig
          ? `${buildSignatureDrawingRun("rIdSig1", `signature.${sigExt}`)}<w:r><w:br/></w:r>${makeTextRun(payload.assessmentDate)}`
          : makeTextRun(payload.assessmentDate);
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, sigRuns) : cXml,
        );
      }
      return rowXml;
    }),
  );

  // Splice tables right-to-left (descending offset) so earlier spans never shift
  let nextDocXml = docXml;
  const tableReplacements: Array<{ span: XmlSpan; xml: string }> = [
    { span: t4Span, xml: updatedT4 },
    { span: t3Span, xml: updatedT3 },
    { span: t2Span, xml: updatedT2 },
    { span: t1Span, xml: updatedT1 },
  ];
  for (const rep of tableReplacements) {
    nextDocXml =
      nextDocXml.slice(0, rep.span.start) + rep.xml + nextDocXml.slice(rep.span.end);
  }

  zip.file("word/document.xml", nextDocXml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\xFF]/g, " ");
}

function drawCellBox(
  page: PDFPage,
  x: number,
  yTop: number,
  width: number,
  height: number,
  fillRgb?: [number, number, number],
) {
  const yBottom = yTop - height;
  if (fillRgb) {
    page.drawRectangle({
      x,
      y: yBottom,
      width,
      height,
      color: rgb(fillRgb[0], fillRgb[1], fillRgb[2]),
      borderColor: rgb(0.15, 0.15, 0.15),
      borderWidth: 0.75,
    });
  } else {
    page.drawRectangle({
      x,
      y: yBottom,
      width,
      height,
      borderColor: rgb(0.15, 0.15, 0.15),
      borderWidth: 0.75,
    });
  }
}

function drawCheckbox(page: PDFPage, centerX: number, yCenter: number, checked: boolean) {
  const size = 9;
  const x = centerX - size / 2;
  const y = yCenter - size / 2;
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    borderColor: rgb(0.15, 0.15, 0.15),
    borderWidth: 0.8,
  });
  if (checked) {
    page.drawLine({
      start: { x: x + 1.8, y: y + 4.3 },
      end: { x: x + 3.8, y: y + 1.8 },
      thickness: 1.3,
      color: rgb(0.05, 0.05, 0.05),
    });
    page.drawLine({
      start: { x: x + 3.8, y: y + 1.8 },
      end: { x: x + 7.5, y: y + 7.2 },
      thickness: 1.3,
      color: rgb(0.05, 0.05, 0.05),
    });
  }
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const clean = toWinAnsiSafe(text.trim() || "-");
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w.slice(0, maxChars);
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ` ${w}`;
    } else {
      lines.push(current);
      current = w.slice(0, maxChars);
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : ["-"];
}

function drawBlankoHeaderFooter(params: {
  page: PDFPage;
  pageNum: number;
  schemeTitle: string;
  fontRegular: PDFFont;
  logoLeft?: PDFImage;
  logoRight?: PDFImage;
}) {
  const { page, pageNum, schemeTitle, fontRegular, logoLeft, logoRight } = params;
  if (logoLeft) {
    page.drawImage(logoLeft, { x: 54, y: 785, width: 82, height: 37 });
  }
  if (logoRight) {
    page.drawImage(logoRight, { x: 448, y: 782, width: 95, height: 42 });
  }
  page.drawText(toWinAnsiSafe(schemeTitle.toUpperCase()), {
    x: 54,
    y: 26,
    size: 7,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });
  page.drawText(`FR.AK.05-2024    |    Halaman ${pageNum}`, {
    x: 425,
    y: 26,
    size: 7,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });
}

/**
 * Renders a 2-page A4 PDF mirroring all 5 tables, BNSP header logos, strikethrough TUK
 * choices, candidate table, notes, and embedded assessor signature of FR.AK.05.
 */
export async function generateAk05Pdf(payload: Ak05ExportPayload): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let logoLeft: PDFImage | undefined;
  let logoRight: PDFImage | undefined;
  try {
    const zip = await JSZip.loadAsync(loadAk05TemplateBuffer());
    const img1 = await zip.file("word/media/image1.png")?.async("nodebuffer");
    const img2 = await zip.file("word/media/image2.png")?.async("nodebuffer");
    if (img1) logoLeft = await pdfDoc.embedPng(img1);
    if (img2) logoRight = await pdfDoc.embedPng(img2);
  } catch {
    // Render cleanly even if header images cannot be read
  }

  let sigImage: PDFImage | undefined;
  if (payload.signaturePngBytes && payload.signaturePngBytes.length > 0) {
    try {
      const kind = detectSignatureImageType(payload.signaturePngBytes, payload.signatureMimeType);
      sigImage =
        kind === "jpg"
          ? await pdfDoc.embedJpg(payload.signaturePngBytes)
          : await pdfDoc.embedPng(payload.signaturePngBytes);
    } catch {
      sigImage = undefined;
    }
  }

  const x0 = 54;
  const page1 = pdfDoc.addPage([595.28, 841.89]);
  drawBlankoHeaderFooter({
    page: page1,
    pageNum: 1,
    schemeTitle: payload.schemeTitle,
    fontRegular,
    logoLeft,
    logoRight,
  });

  // Table 0: FR.AK.05. | LAPORAN ASESMEN
  let y = 768;
  drawCellBox(page1, x0, y, 125, 24);
  drawCellBox(page1, x0 + 125, y, 365, 24);
  page1.drawText("FR.AK.05.", { x: x0 + 10, y: y - 16, size: 11, font: fontBold });
  page1.drawText("LAPORAN ASESMEN", { x: x0 + 135, y: y - 16, size: 11, font: fontBold });
  y -= 32;

  // Table 1: 5-row Metadata block (widths: 130 | 55 | 18 | 287 = 490)
  const w1 = 130;
  const w2 = 55;
  const w3 = 18;
  const w4 = 287;
  drawCellBox(page1, x0, y, w1, 44);
  drawCellBox(page1, x0 + w1, y, w2, 22);
  drawCellBox(page1, x0 + w1 + w2, y, w3, 22);
  drawCellBox(page1, x0 + w1 + w2 + w3, y, w4, 22);
  drawCellBox(page1, x0 + w1, y - 22, w2, 22);
  drawCellBox(page1, x0 + w1 + w2, y - 22, w3, 22);
  drawCellBox(page1, x0 + w1 + w2 + w3, y - 22, w4, 22);

  page1.drawText("Skema Sertifikasi", { x: x0 + 6, y: y - 15, size: 9, font: fontRegular });
  page1.drawText("(KKNI/Okupasi/Klaster)", { x: x0 + 6, y: y - 28, size: 8, font: fontRegular });
  page1.drawText("Judul", { x: x0 + w1 + 6, y: y - 15, size: 9, font: fontRegular });
  page1.drawText(":", { x: x0 + w1 + w2 + 7, y: y - 15, size: 9, font: fontRegular });
  page1.drawText(toWinAnsiSafe(payload.schemeTitle).slice(0, 52), {
    x: x0 + w1 + w2 + w3 + 6,
    y: y - 15,
    size: 9,
    font: fontBold,
  });
  page1.drawText("Nomor", { x: x0 + w1 + 6, y: y - 37, size: 9, font: fontRegular });
  page1.drawText(":", { x: x0 + w1 + w2 + 7, y: y - 37, size: 9, font: fontRegular });
  page1.drawText(toWinAnsiSafe(payload.schemeNumber).slice(0, 48), {
    x: x0 + w1 + w2 + w3 + 6,
    y: y - 37,
    size: 9,
    font: fontBold,
  });
  y -= 44;

  // TUK Row
  drawCellBox(page1, x0, y, w1 + w2, 22);
  drawCellBox(page1, x0 + w1 + w2, y, w3, 22);
  drawCellBox(page1, x0 + w1 + w2 + w3, y, w4, 22);
  page1.drawText("TUK", { x: x0 + 6, y: y - 15, size: 9, font: fontRegular });
  page1.drawText(":", { x: x0 + w1 + w2 + 7, y: y - 15, size: 9, font: fontRegular });
  const tukStartX = x0 + w1 + w2 + w3 + 6;
  const tukY = y - 15;
  const tukSegments: Array<{ label: string; struck: boolean }> = [
    { label: "Sewaktu", struck: payload.tukType !== "sewaktu" },
    { label: " / ", struck: false },
    { label: "Tempat Kerja", struck: payload.tukType !== "tempat_kerja" },
    { label: " / ", struck: false },
    { label: "Mandiri*", struck: payload.tukType !== "mandiri" },
  ];
  let cursorX = tukStartX;
  for (const seg of tukSegments) {
    page1.drawText(seg.label, { x: cursorX, y: tukY, size: 9, font: fontRegular });
    const sw = fontRegular.widthOfTextAtSize(seg.label, 9);
    if (seg.struck) {
      page1.drawLine({
        start: { x: cursorX, y: tukY + 3 },
        end: { x: cursorX + sw, y: tukY + 3 },
        thickness: 0.75,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
    cursorX += sw;
  }
  if (payload.tukName && payload.tukName.trim() && payload.tukName.trim() !== "-") {
    page1.drawText(toWinAnsiSafe(` (${payload.tukName.trim()})`).slice(0, 26), {
      x: cursorX,
      y: tukY,
      size: 9,
      font: fontBold,
    });
  }
  y -= 22;

  // Nama Asesor & Tanggal Rows
  for (const [label, val] of [
    ["Nama Asesor", payload.assessorName],
    ["Tanggal", payload.assessmentDate],
  ] as const) {
    drawCellBox(page1, x0, y, w1 + w2, 22);
    drawCellBox(page1, x0 + w1 + w2, y, w3, 22);
    drawCellBox(page1, x0 + w1 + w2 + w3, y, w4, 22);
    page1.drawText(label, { x: x0 + 6, y: y - 15, size: 9, font: fontRegular });
    page1.drawText(":", { x: x0 + w1 + w2 + 7, y: y - 15, size: 9, font: fontRegular });
    page1.drawText(toWinAnsiSafe(val).slice(0, 48), {
      x: x0 + w1 + w2 + w3 + 6,
      y: y - 15,
      size: 9,
      font: fontRegular,
    });
    y -= 22;
  }

  y -= 12;

  // Table 2: Candidate Results Table (col widths: 34 | 184 | 38 | 38 | 196 = 490)
  const cw = [34, 184, 38, 38, 196] as const;
  const drawTable2Header = (p: PDFPage, yTop: number) => {
    drawCellBox(p, x0, yTop, cw[0], 34);
    drawCellBox(p, x0 + cw[0], yTop, cw[1], 34);
    drawCellBox(p, x0 + cw[0] + cw[1], yTop, cw[2] + cw[3], 17);
    drawCellBox(p, x0 + cw[0] + cw[1], yTop - 17, cw[2], 17);
    drawCellBox(p, x0 + cw[0] + cw[1] + cw[2], yTop - 17, cw[3], 17);
    drawCellBox(p, x0 + cw[0] + cw[1] + cw[2] + cw[3], yTop, cw[4], 34);

    p.drawText("No.", { x: x0 + 10, y: yTop - 20, size: 9, font: fontBold });
    p.drawText("Nama Asesi", { x: x0 + cw[0] + 6, y: yTop - 20, size: 9, font: fontBold });
    p.drawText("Rekomendasi", {
      x: x0 + cw[0] + cw[1] + 8,
      y: yTop - 12,
      size: 9,
      font: fontBold,
    });
    p.drawText("K", { x: x0 + cw[0] + cw[1] + 15, y: yTop - 29, size: 9, font: fontBold });
    p.drawText("BK", {
      x: x0 + cw[0] + cw[1] + cw[2] + 12,
      y: yTop - 29,
      size: 9,
      font: fontBold,
    });
    p.drawText("Keterangan**", {
      x: x0 + cw[0] + cw[1] + cw[2] + cw[3] + 6,
      y: yTop - 20,
      size: 9,
      font: fontBold,
    });
    return yTop - 34;
  };

  const drawCandidateRow = (
    p: PDFPage,
    yTop: number,
    index: number,
    cand?: Ak05ExportPayload["rows"][number],
  ) => {
    const rowH = 22;
    drawCellBox(p, x0, yTop, cw[0], rowH);
    drawCellBox(p, x0 + cw[0], yTop, cw[1], rowH);
    drawCellBox(p, x0 + cw[0] + cw[1], yTop, cw[2], rowH);
    drawCellBox(p, x0 + cw[0] + cw[1] + cw[2], yTop, cw[3], rowH);
    drawCellBox(p, x0 + cw[0] + cw[1] + cw[2] + cw[3], yTop, cw[4], rowH);

    p.drawText(`${index + 1}.`, { x: x0 + 11, y: yTop - 14, size: 9, font: fontRegular });
    if (cand) {
      p.drawText(toWinAnsiSafe(cand.assesseeName).slice(0, 34), {
        x: x0 + cw[0] + 6,
        y: yTop - 14,
        size: 9,
        font: fontRegular,
      });
      drawCheckbox(p, x0 + cw[0] + cw[1] + cw[2] / 2, yTop - 11, cand.recommendation === "K");
      drawCheckbox(
        p,
        x0 + cw[0] + cw[1] + cw[2] + cw[3] / 2,
        yTop - 11,
        cand.recommendation === "BK",
      );
      if (cand.keterangan) {
        p.drawText(toWinAnsiSafe(cand.keterangan).slice(0, 36), {
          x: x0 + cw[0] + cw[1] + cw[2] + cw[3] + 6,
          y: yTop - 14,
          size: 8,
          font: fontRegular,
        });
      }
    }
    return yTop - rowH;
  };

  y = drawTable2Header(page1, y);
  const totalSlots = Math.max(12, payload.rows.length);
  const page1Slots = Math.min(18, totalSlots);
  for (let i = 0; i < page1Slots; i++) {
    y = drawCandidateRow(page1, y, i, payload.rows[i]);
  }

  // Page 2: Overflow candidate rows (if >18) + Footnotes + Table 3 + Table 4
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  drawBlankoHeaderFooter({
    page: page2,
    pageNum: 2,
    schemeTitle: payload.schemeTitle,
    fontRegular,
    logoLeft,
    logoRight,
  });

  let y2 = 768;
  if (totalSlots > page1Slots) {
    y2 = drawTable2Header(page2, y2);
    for (let i = page1Slots; i < totalSlots; i++) {
      y2 = drawCandidateRow(page2, y2, i, payload.rows[i]);
    }
    y2 -= 12;
  }

  page2.drawText("**Tuliskan Kode dan Judul Unit Kompetensi yang dinyatakan BK bila mengases satu skema", {
    x: x0,
    y: y2 - 6,
    size: 8,
    font: fontRegular,
    color: rgb(0.25, 0.25, 0.25),
  });
  y2 -= 20;

  // Table 3: Qualitative Notes (widths: 170 | 320 = 490, left cell shaded #92D050)
  const t3LeftRgb: [number, number, number] = [146 / 255, 208 / 255, 80 / 255];
  const noteRows: Array<[string, string]> = [
    ["Aspek Negatif dan Positif dalam asesmen", payload.notesPositiveNegative || "-"],
    ["Pencatatan penolakan hasil asesmen", payload.notesRejection || "-"],
    ["Saran perbaikan (Asesor/personil terkait)", payload.notesImprovement || "-"],
  ];
  for (const [label, textVal] of noteRows) {
    const h = 44;
    drawCellBox(page2, x0, y2, 170, h, t3LeftRgb);
    drawCellBox(page2, x0 + 170, y2, 320, h);
    const labelLines = wrapLines(label, 28, 3);
    labelLines.forEach((line, lIdx) => {
      page2.drawText(line, { x: x0 + 6, y: y2 - 14 - lIdx * 11, size: 8.5, font: fontRegular });
    });
    const valLines = wrapLines(textVal, 58, 3);
    valLines.forEach((line, lIdx) => {
      page2.drawText(line, { x: x0 + 176, y: y2 - 14 - lIdx * 11, size: 8.5, font: fontRegular });
    });
    y2 -= h;
  }

  y2 -= 14;

  // Table 4: Catatan + Asesor Signature Block (widths: 245 | 90 | 155 = 490)
  const cLeft = 245;
  const cMid = 90;
  const cRight = 155;
  const t4HeaderH = 22;
  const t4NameH = 22;
  const t4RegH = 22;
  const t4SigH = 74;
  const t4TotalH = t4HeaderH + t4NameH + t4RegH + t4SigH;

  drawCellBox(page2, x0, y2, cLeft, t4TotalH);
  page2.drawText("Catatan :", { x: x0 + 8, y: y2 - 15, size: 9, font: fontBold });

  // Right-hand header ("Asesor :") spanning cMid + cRight
  drawCellBox(page2, x0 + cLeft, y2, cMid + cRight, t4HeaderH);
  page2.drawText("Asesor :", { x: x0 + cLeft + 6, y: y2 - 15, size: 9, font: fontBold });
  y2 -= t4HeaderH;

  // Nama
  drawCellBox(page2, x0 + cLeft, y2, cMid, t4NameH);
  drawCellBox(page2, x0 + cLeft + cMid, y2, cRight, t4NameH);
  page2.drawText("Nama", { x: x0 + cLeft + 6, y: y2 - 15, size: 9, font: fontRegular });
  page2.drawText(toWinAnsiSafe(payload.assessorName).slice(0, 28), {
    x: x0 + cLeft + cMid + 6,
    y: y2 - 15,
    size: 9,
    font: fontBold,
  });
  y2 -= t4NameH;

  // No. Reg
  drawCellBox(page2, x0 + cLeft, y2, cMid, t4RegH);
  drawCellBox(page2, x0 + cLeft + cMid, y2, cRight, t4RegH);
  page2.drawText("No. Reg", { x: x0 + cLeft + 6, y: y2 - 15, size: 9, font: fontRegular });
  page2.drawText(toWinAnsiSafe(payload.assessorRegNo).slice(0, 28), {
    x: x0 + cLeft + cMid + 6,
    y: y2 - 15,
    size: 9,
    font: fontRegular,
  });
  y2 -= t4RegH;

  // Tanda tangan & tanggal
  drawCellBox(page2, x0 + cLeft, y2, cMid, t4SigH);
  drawCellBox(page2, x0 + cLeft + cMid, y2, cRight, t4SigH);
  page2.drawText("Tanda tangan", { x: x0 + cLeft + 6, y: y2 - 18, size: 9, font: fontRegular });
  page2.drawText("& tanggal", { x: x0 + cLeft + 6, y: y2 - 30, size: 9, font: fontRegular });

  if (sigImage) {
    page2.drawImage(sigImage, {
      x: x0 + cLeft + cMid + 14,
      y: y2 - 50,
      width: 110,
      height: 44,
    });
  }
  page2.drawText(toWinAnsiSafe(payload.assessmentDate), {
    x: x0 + cLeft + cMid + 6,
    y: y2 - 64,
    size: 8.5,
    font: fontRegular,
  });

  page2.drawText("* Coret yang tidak perlu", {
    x: x0,
    y: y2 - t4SigH - 16,
    size: 8,
    font: fontRegular,
    color: rgb(0.25, 0.25, 0.25),
  });

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
