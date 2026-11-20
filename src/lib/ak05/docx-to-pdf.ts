import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 38;
const FONT_SIZE = 8.5;

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function extractLines(documentXml: string): string[] {
  const lines: string[] = [];
  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  for (const match of documentXml.matchAll(paragraphRegex)) {
    const chunk = match[1] ?? "";
    const text = [...chunk.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((t) => decodeXml(t[1] ?? ""))
      .join("")
      .trim();
    if (text) lines.push(text.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?"));
  }
  return lines;
}

function wrapText(text: string, font: PDFFont, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, FONT_SIZE) <= maxWidth || !current) {
      current = candidate;
    } else {
      out.push(current);
      current = word;
    }
  }
  if (current) out.push(current);
  return out;
}

function drawLines(page: PDFPage, lines: string[], font: PDFFont): void {
  let y = PAGE_H - MARGIN;
  for (const line of lines) {
    for (const wrapped of wrapText(line, font, PAGE_W - MARGIN * 2)) {
      if (y < MARGIN + 10) return;
      page.drawText(wrapped, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
      y -= FONT_SIZE + 3;
    }
  }
}

/**
 * Converts the already-filled AK.05 DOCX into PDF. Keeps the DOCX template as
 * the single layout/content source (no second hand-drawn PDF layout).
 */
export async function renderAk05DocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const documentXml = await zip.file("word/document.xml")!.async("string");
  const lines = extractLines(documentXml);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const splitAt = lines.findIndex((l) => /tanda tangan|tandatangan/i.test(l));
  const firstPage = splitAt > 0 ? lines.slice(0, splitAt) : lines;
  const secondPage = splitAt > 0 ? lines.slice(splitAt) : [];

  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawLines(page1, firstPage, font);

  const mediaFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("word/media/") && /\.(png|jpe?g)$/i.test(name),
  );
  const signatureFile = mediaFiles.find((name) => /signature/i.test(name));
  if (signatureFile) {
    const bytes = await zip.file(signatureFile)!.async("uint8array");
    const isPng = /\.png$/i.test(signatureFile);
    const image = isPng
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    const page2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawLines(page2, secondPage, font);
    const dims = image.scale(0.4);
    const w = Math.min(dims.width, 140);
    page2.drawImage(image, {
      x: MARGIN,
      y: PAGE_H - MARGIN - 80,
      width: w,
      height: (image.height / image.width) * w,
    });
  } else if (secondPage.length > 0) {
    const page2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawLines(page2, secondPage, font);
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
