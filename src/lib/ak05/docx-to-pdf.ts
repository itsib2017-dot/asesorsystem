import JSZip from "jszip";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { AK05_LAYOUT } from "./layout";

const [PAGE_W, PAGE_H] = AK05_LAYOUT.pageSizeA4Pt;
const MARGIN_X = AK05_LAYOUT.marginXPt;
const RIGHT_EDGE_X = AK05_LAYOUT.rightEdgeXPt;
const CONTENT_W = RIGHT_EDGE_X - MARGIN_X;
const TOP_Y = PAGE_H - 46;
const FOOTER_DIVIDER_Y = 50;
const BOTTOM_SAFE_Y = 66;
const BODY_FONT_SIZE = 8.5;
const CELL_FONT_SIZE = 8;
const LINE_HEIGHT = 11.2;
const CELL_PAD_X = 5;
const CELL_PAD_Y = 4;

export type LineToken =
  | { type: "text"; value: string }
  | { type: "checkbox"; checked: boolean };

interface ParsedParagraph {
  lines: string[];
  bold: boolean;
  align: "left" | "center" | "right";
  pageBreakBefore: boolean;
  imagePaths: string[];
}

interface ParsedCell {
  gridSpan: number;
  fillRgb: [number, number, number] | null;
  vMergeContinue: boolean;
  paragraphs: ParsedParagraph[];
}

interface ParsedRow {
  isHeader: boolean;
  cells: ParsedCell[];
}

interface ParsedTable {
  colWidths: number[];
  hasBorders: boolean;
  rows: ParsedRow[];
}

type BodyBlock =
  | { kind: "p"; paragraph: ParsedParagraph }
  | { kind: "tbl"; table: ParsedTable };

interface EmbeddedAsset {
  image: PDFImage;
  isSignature: boolean;
  path: string;
}

/**
 * Normalizes typographic Unicode punctuation to clean WinAnsi characters supported
 * by PDF StandardFonts without introducing '?' replacement noise.
 */
export function sanitizeWinAnsiText(input: string): string {
  const normalized = input
    .replace(/[\u2014\u2013\u2212]/g, "-")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/\u2022/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2192\u2794]/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u2264/g, "<=")
    .replace(/\u2265/g, ">=")
    .replace(/\u00D7/g, "x")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");

  return normalized.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
}

/**
 * Splits a text line into plain WinAnsi spans and vector checkbox tokens.
 */
export function tokenizeCheckboxSegments(input: string): LineToken[] {
  const CHECKBOX_GLYPH_RE = /([\u2610\u2611\u2612\u2713\u2714])/;
  const parts = input.split(CHECKBOX_GLYPH_RE);
  const tokens: LineToken[] = [];

  for (const part of parts) {
    if (!part) continue;
    if (
      part === "\u2611" ||
      part === "\u2612" ||
      part === "\u2713" ||
      part === "\u2714"
    ) {
      tokens.push({ type: "checkbox", checked: true });
    } else if (part === "\u2610") {
      tokens.push({ type: "checkbox", checked: false });
    } else {
      const clean = sanitizeWinAnsiText(part);
      if (clean) tokens.push({ type: "text", value: clean });
    }
  }

  return tokens;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function extractBalancedElements(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const tokenRe = new RegExp(
    `<${tagName}(?=[\\s>/])[^>]*\\/>|<${tagName}(?=[\\s>])[^>]*>|<\\/${tagName}>`,
    "g",
  );
  let depth = 0;
  let start = -1;

  for (const match of xml.matchAll(tokenRe)) {
    const token = match[0];
    const idx = match.index ?? 0;
    if (token.startsWith(`</${tagName}`)) {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          results.push(xml.slice(start, idx + token.length));
          start = -1;
        }
      }
    } else if (token.endsWith("/>")) {
      if (depth === 0) {
        results.push(token);
      }
    } else {
      if (depth === 0) start = idx;
      depth += 1;
    }
  }

  return results;
}

function extractBodyBlocksXml(
  documentXml: string,
): Array<{ kind: "p" | "tbl"; xml: string }> {
  const bodyMatch = documentXml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/);
  const bodyXml = bodyMatch?.[1] ?? documentXml;
  const blocks: Array<{ kind: "p" | "tbl"; xml: string }> = [];

  const tagRe =
    /<w:(p|tbl)(?=[\s>/])[^>]*\/>|<w:(p|tbl)(?=[\s>])[^>]*>|<\/w:(p|tbl)>/g;
  let pDepth = 0;
  let tblDepth = 0;
  let start = -1;
  let activeKind: "p" | "tbl" | null = null;

  for (const match of bodyXml.matchAll(tagRe)) {
    const token = match[0];
    const idx = match.index ?? 0;

    if (token.startsWith("</w:tbl")) {
      if (tblDepth > 0) {
        tblDepth -= 1;
        if (tblDepth === 0 && activeKind === "tbl" && start >= 0) {
          blocks.push({ kind: "tbl", xml: bodyXml.slice(start, idx + token.length) });
          activeKind = null;
          start = -1;
        }
      }
    } else if (token.startsWith("</w:p")) {
      if (pDepth > 0) {
        pDepth -= 1;
        if (pDepth === 0 && tblDepth === 0 && activeKind === "p" && start >= 0) {
          blocks.push({ kind: "p", xml: bodyXml.slice(start, idx + token.length) });
          activeKind = null;
          start = -1;
        }
      }
    } else if (token.startsWith("<w:tbl")) {
      if (token.endsWith("/>")) continue;
      if (tblDepth === 0 && pDepth === 0) {
        activeKind = "tbl";
        start = idx;
      }
      tblDepth += 1;
    } else if (token.startsWith("<w:p")) {
      if (token.endsWith("/>")) continue;
      if (tblDepth === 0 && pDepth === 0) {
        activeKind = "p";
        start = idx;
      }
      pDepth += 1;
    }
  }

  return blocks;
}

function parseRelationshipMap(relsXml: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!relsXml) return map;
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = match[0];
    const idMatch = tag.match(/\bId="([^"]+)"/);
    const targetMatch = tag.match(/\bTarget="([^"]+)"/);
    if (idMatch?.[1] && targetMatch?.[1]) {
      const normalizedTarget = targetMatch[1].replace(/^\/+/, "");
      const fullPath = normalizedTarget.startsWith("word/")
        ? normalizedTarget
        : `word/${normalizedTarget}`;
      map.set(idMatch[1], fullPath);
    }
  }
  return map;
}

function resolveWordSymbolChar(symTag: string): string {
  const charMatch = symTag.match(/w:char="([0-9A-Fa-f]+)"/);
  const code = (charMatch?.[1] ?? "").toUpperCase();
  if (
    code === "F0FE" ||
    code === "00FE" ||
    code === "2611" ||
    code === "2612" ||
    code === "2713" ||
    code === "2714" ||
    code === "0052"
  ) {
    return "\u2611";
  }
  if (code === "F0A8" || code === "00A8" || code === "2610" || code === "006F") {
    return "\u2610";
  }
  return "";
}

function parseParagraphXml(
  pXml: string,
  relMap: Map<string, string>,
): ParsedParagraph {
  const pPr = pXml.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/)?.[1] ?? "";
  const pageBreakBefore =
    /<w:pageBreakBefore(?:\s*\/>|\s+w:val="(?!0"|false")[^"]*")/.test(pPr) ||
    /<w:br\b[^>]*w:type="page"/.test(pXml);

  const jcMatch = pPr.match(/<w:jc\b[^>]*w:val="([^"]+)"/);
  const rawJc = jcMatch?.[1]?.toLowerCase() ?? "left";
  const align: "left" | "center" | "right" =
    rawJc === "center" ? "center" : rawJc === "right" ? "right" : "left";

  const hasPPrBold = /<w:b(?![a-zA-Z])(?![^>]*w:val="(?:0|false)")/.test(pPr);
  const textRunMatches = [...pXml.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)].filter((m) =>
    /<w:t\b/.test(m[1] ?? ""),
  );
  const hasAnyRunBold =
    textRunMatches.length > 0 &&
    textRunMatches.every((m) =>
      /<w:b(?![a-zA-Z])(?![^>]*w:val="(?:0|false)")/.test(m[1] ?? ""),
    );
  const bold = hasPPrBold || hasAnyRunBold;

  const imagePaths: string[] = [];
  for (const imgMatch of pXml.matchAll(
    /(?:r:embed|r:id)="([^"]+)"/g,
  )) {
    const rId = imgMatch[1];
    if (rId) {
      const target = relMap.get(rId);
      if (target && /\.(png|jpe?g)$/i.test(target)) {
        imagePaths.push(target);
      }
    }
  }

  let bufferText = "";
  const tokenRe =
    /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b([^>]*)\/>|<w:sym\b([^>]*)\/>|<w:checkBox\b[^>]*>([\s\S]*?)<\/w:checkBox>/g;

  for (const match of pXml.matchAll(tokenRe)) {
    if (match[1] !== undefined) {
      bufferText += decodeXml(match[1]);
    } else if (match[0].startsWith("<w:tab")) {
      bufferText += "  ";
    } else if (match[0].startsWith("<w:br")) {
      const attrs = match[2] ?? "";
      if (!/w:type="page"/.test(attrs)) {
        bufferText += "\n";
      }
    } else if (match[0].startsWith("<w:sym")) {
      bufferText += resolveWordSymbolChar(match[3] ?? "");
    } else if (match[0].startsWith("<w:checkBox")) {
      const inner = match[4] ?? "";
      const checked =
        /<w:checked(?:\s*\/>|\s+w:val="(?!0"|false")[^"]*")/.test(inner) ||
        /<w:default\b[^>]*w:val="1"/.test(inner);
      bufferText += checked ? "\u2611" : "\u2610";
    }
  }

  const lines = bufferText
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0);

  return {
    lines,
    bold,
    align,
    pageBreakBefore,
    imagePaths,
  };
}

function parseHexColorRgb(hexRaw: string | undefined): [number, number, number] | null {
  if (!hexRaw) return null;
  const clean = hexRaw.replace(/^#/, "").trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
  const upper = clean.toUpperCase();
  if (upper === "FFFFFF" || upper === "000000") return null;
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function scaleGridWidths(rawWidths: number[], targetWidth: number): number[] {
  const valid = rawWidths.map((w) => (Number.isFinite(w) && w > 0 ? w : 1000));
  const total = valid.reduce((acc, w) => acc + w, 0);
  if (total <= 0) return [targetWidth];
  return valid.map((w) => (w / total) * targetWidth);
}

function parseTableXml(
  tblXml: string,
  relMap: Map<string, string>,
): ParsedTable {
  const tblPr = tblXml.match(/<w:tblPr\b[^>]*>([\s\S]*?)<\/w:tblPr>/)?.[1] ?? "";
  const bordersMatch = tblPr.match(/<w:tblBorders\b[^>]*>([\s\S]*?)<\/w:tblBorders>/);
  let hasBorders = true;
  if (bordersMatch?.[1]) {
    const borderVals = [...bordersMatch[1].matchAll(/w:val="([^"]+)"/g)].map(
      (m) => m[1]?.toLowerCase() ?? "",
    );
    if (
      borderVals.length > 0 &&
      borderVals.every((v) => v === "none" || v === "nil")
    ) {
      hasBorders = false;
    }
  }

  const gridXml = tblXml.match(/<w:tblGrid\b[^>]*>([\s\S]*?)<\/w:tblGrid>/)?.[1] ?? "";
  const gridCols = [...gridXml.matchAll(/<w:gridCol\b[^>]*w:w="(\d+)"/g)].map((m) =>
    Number(m[1]),
  );

  const rawRows = extractBalancedElements(tblXml, "w:tr");
  const rows: ParsedRow[] = rawRows.map((trXml, rowIdx) => {
    const trPr = trXml.match(/<w:trPr\b[^>]*>([\s\S]*?)<\/w:trPr>/)?.[1] ?? "";
    const explicitHeader = /<w:tblHeader(?:\s*\/>|\s+w:val="(?!0"|false")[^"]*")/.test(trPr);

    const rawCells = extractBalancedElements(trXml, "w:tc");
    const cells: ParsedCell[] = rawCells.map((tcXml) => {
      const tcPr = tcXml.match(/<w:tcPr\b[^>]*>([\s\S]*?)<\/w:tcPr>/)?.[1] ?? "";
      const spanMatch = tcPr.match(/<w:gridSpan\b[^>]*w:val="(\d+)"/);
      const gridSpan = spanMatch?.[1] ? Math.max(1, Number(spanMatch[1])) : 1;

      const shdMatch = tcPr.match(/<w:shd\b[^>]*w:fill="([^"]+)"/);
      const fillRgb = parseHexColorRgb(shdMatch?.[1]);

      const hasVMergeTag = /<w:vMerge(?:\s*\/>|\s+[^>]*)>/.test(tcPr);
      const isVMergeRestart = /<w:vMerge\b[^>]*w:val="restart"/.test(tcPr);
      const vMergeContinue = hasVMergeTag && !isVMergeRestart;

      const paragraphs = extractBalancedElements(tcXml, "w:p").map((p) =>
        parseParagraphXml(p, relMap),
      );

      return {
        gridSpan,
        fillRgb,
        vMergeContinue,
        paragraphs,
      };
    });

    const firstRowGreenHeader =
      rowIdx === 0 &&
      cells.some((c) => {
        if (!c.fillRgb) return false;
        const [r, g, b] = c.fillRgb;
        return g > 0.6 && g >= r && b < 0.7;
      });

    return {
      isHeader: explicitHeader || firstRowGreenHeader,
      cells,
    };
  });

  let colWidths: number[];
  if (gridCols.length > 0) {
    colWidths = scaleGridWidths(gridCols, CONTENT_W);
  } else {
    const maxCols = Math.max(
      1,
      ...rows.map((r) => r.cells.reduce((sum, c) => sum + c.gridSpan, 0)),
    );
    colWidths = Array.from({ length: maxCols }, () => CONTENT_W / maxCols);
  }

  return { colWidths, hasBorders, rows };
}

function measureTokensWidth(
  tokens: LineToken[],
  font: PDFFont,
  fontSize: number,
): number {
  let width = 0;
  for (const tok of tokens) {
    if (tok.type === "checkbox") {
      width += fontSize + 3;
    } else {
      width += font.widthOfTextAtSize(tok.value, fontSize);
    }
  }
  return width;
}

function wrapLineTokens(
  rawLine: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): LineToken[][] {
  const words = rawLine.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const spaceW = font.widthOfTextAtSize(" ", fontSize);
  const wrapped: LineToken[][] = [];
  let currentChunks: string[] = [];
  let currentWidth = 0;

  for (const word of words) {
    const wordW = measureTokensWidth(tokenizeCheckboxSegments(word), font, fontSize);
    const nextWidth = currentChunks.length > 0 ? currentWidth + spaceW + wordW : wordW;
    if (nextWidth <= maxWidth || currentChunks.length === 0) {
      currentChunks.push(word);
      currentWidth = nextWidth;
    } else {
      wrapped.push(tokenizeCheckboxSegments(currentChunks.join(" ")));
      currentChunks = [word];
      currentWidth = wordW;
    }
  }
  if (currentChunks.length > 0) {
    wrapped.push(tokenizeCheckboxSegments(currentChunks.join(" ")));
  }
  return wrapped;
}

function drawTokenLine(params: {
  page: PDFPage;
  tokens: LineToken[];
  x: number;
  y: number;
  maxWidth: number;
  align: "left" | "center" | "right";
  font: PDFFont;
  fontSize: number;
}): void {
  const lineWidth = measureTokensWidth(params.tokens, params.font, params.fontSize);
  let cursorX = params.x;
  if (params.align === "center" && lineWidth < params.maxWidth) {
    cursorX = params.x + (params.maxWidth - lineWidth) / 2;
  } else if (params.align === "right" && lineWidth < params.maxWidth) {
    cursorX = params.x + (params.maxWidth - lineWidth);
  }

  for (const tok of params.tokens) {
    if (tok.type === "checkbox") {
      const boxSize = Math.max(6.5, params.fontSize - 0.8);
      const boxY = params.y - 0.8;
      params.page.drawRectangle({
        x: cursorX + 1,
        y: boxY,
        width: boxSize,
        height: boxSize,
        borderColor: rgb(0.15, 0.2, 0.25),
        borderWidth: 0.65,
        color: rgb(1, 1, 1),
      });
      if (tok.checked) {
        params.page.drawLine({
          start: { x: cursorX + 2.2, y: boxY + boxSize * 0.45 },
          end: { x: cursorX + 1 + boxSize * 0.42, y: boxY + 1.5 },
          thickness: 1.0,
          color: rgb(0.06, 0.45, 0.35),
        });
        params.page.drawLine({
          start: { x: cursorX + 1 + boxSize * 0.42, y: boxY + 1.5 },
          end: { x: cursorX + boxSize - 0.4, y: boxY + boxSize - 1.4 },
          thickness: 1.0,
          color: rgb(0.06, 0.45, 0.35),
        });
      }
      cursorX += params.fontSize + 3;
    } else {
      params.page.drawText(tok.value, {
        x: cursorX,
        y: params.y,
        size: params.fontSize,
        font: params.font,
        color: rgb(0.08, 0.1, 0.14),
      });
      cursorX += params.font.widthOfTextAtSize(tok.value, params.fontSize);
    }
  }
}

function drawPageFooters(pdfDoc: PDFDocument, font: PDFFont, fontBold: PDFFont): void {
  const pages = pdfDoc.getPages();
  const total = pages.length;
  const [fR, fG, fB] = AK05_LAYOUT.colors.footerDividerRgb;
  const [bR, bG, bB] = AK05_LAYOUT.colors.pageBadgeRgb;

  pages.forEach((page, idx) => {
    page.drawLine({
      start: { x: MARGIN_X, y: FOOTER_DIVIDER_Y },
      end: { x: RIGHT_EDGE_X, y: FOOTER_DIVIDER_Y },
      thickness: 1.2,
      color: rgb(fR, fG, fB),
    });

    page.drawText(AK05_LAYOUT.formCode, {
      x: MARGIN_X,
      y: FOOTER_DIVIDER_Y - 14,
      size: 7.5,
      font: fontBold,
      color: rgb(0.25, 0.3, 0.38),
    });

    const badgeText = `Halaman ${idx + 1} / ${total}`;
    const badgeW = font.widthOfTextAtSize(badgeText, 7.5) + 14;
    page.drawRectangle({
      x: RIGHT_EDGE_X - badgeW,
      y: FOOTER_DIVIDER_Y - 18,
      width: badgeW,
      height: 13,
      color: rgb(bR, bG, bB),
    });
    page.drawText(badgeText, {
      x: RIGHT_EDGE_X - badgeW + 7,
      y: FOOTER_DIVIDER_Y - 14,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.16, 0.12),
    });
  });
}

function resolveSpanWidth(
  colWidths: number[],
  colIdx: number,
  gridSpan: number,
): number {
  let width = 0;
  for (let i = 0; i < gridSpan; i += 1) {
    width += colWidths[colIdx + i] ?? (colWidths[colWidths.length - 1] ?? 60);
  }
  return Math.max(width, 20);
}

/**
 * Converts a filled FR.AK.05 DOCX (official or custom template) into a structured,
 * paginated A4 PDF preserving OOXML tables, fills, vector checkboxes, and embedded
 * signatures/logos without text truncation or '?' replacement glyphs.
 */
export async function renderAk05DocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error("Invalid DOCX archive: missing word/document.xml");
  }
  const relsXml = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? null;
  const relMap = parseRelationshipMap(relsXml);

  const rawBlocks = extractBodyBlocksXml(documentXml);
  const blocks: BodyBlock[] = rawBlocks.map((b) =>
    b.kind === "tbl"
      ? { kind: "tbl", table: parseTableXml(b.xml, relMap) }
      : { kind: "p", paragraph: parseParagraphXml(b.xml, relMap) },
  );

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const referencedMedia = new Set<string>();
  for (const b of blocks) {
    if (b.kind === "p") {
      b.paragraph.imagePaths.forEach((p) => referencedMedia.add(p));
    } else {
      b.table.rows.forEach((r) =>
        r.cells.forEach((c) =>
          c.paragraphs.forEach((p) => p.imagePaths.forEach((ip) => referencedMedia.add(ip))),
        ),
      );
    }
  }

  const mediaCache = new Map<string, EmbeddedAsset>();
  const mediaPaths = Object.keys(zip.files).filter(
    (name) =>
      name.startsWith("word/media/") &&
      /\.(png|jpe?g)$/i.test(name) &&
      (referencedMedia.has(name) || /signature/i.test(name)),
  );
  for (const mediaPath of mediaPaths) {
    const file = zip.file(mediaPath);
    if (!file) continue;
    try {
      const bytes = await file.async("uint8array");
      const image = /\.png$/i.test(mediaPath)
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes);
      mediaCache.set(mediaPath, {
        image,
        isSignature: /signature/i.test(mediaPath),
        path: mediaPath,
      });
    } catch {
      // Ignore unreadable optional media
    }
  }

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let cursorY = TOP_Y;
  let renderedSignatureOnPage = false;

  const startNewPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    cursorY = TOP_Y;
  };

  const renderStandaloneParagraph = (p: ParsedParagraph) => {
    if (p.pageBreakBefore && cursorY < TOP_Y - 10) {
      startNewPage();
    }

    const activeFont = p.bold ? fontBold : fontRegular;
    const isTitle = p.bold && p.lines.some((l) => /LAPORAN\s+ASESMEN|FR\.AK\.05/i.test(l));
    const fontSize = isTitle ? 10 : BODY_FONT_SIZE;
    const lineStep = fontSize + 3;

    for (const imgPath of p.imagePaths) {
      const asset = mediaCache.get(imgPath);
      if (!asset) continue;
      const maxW = asset.isSignature ? 110 : 75;
      const maxH = asset.isSignature ? 46 : 42;
      const scale = Math.min(maxW / asset.image.width, maxH / asset.image.height, 1);
      const drawW = asset.image.width * scale;
      const drawH = asset.image.height * scale;
      if (cursorY - drawH < BOTTOM_SAFE_Y) startNewPage();
      page.drawImage(asset.image, {
        x: MARGIN_X,
        y: cursorY - drawH,
        width: drawW,
        height: drawH,
      });
      if (asset.isSignature) renderedSignatureOnPage = true;
      cursorY -= drawH + 4;
    }

    for (const rawLine of p.lines) {
      const wrappedLines = wrapLineTokens(rawLine, activeFont, fontSize, CONTENT_W);
      for (const tokens of wrappedLines) {
        if (cursorY - lineStep < BOTTOM_SAFE_Y) {
          startNewPage();
        }
        drawTokenLine({
          page,
          tokens,
          x: MARGIN_X,
          y: cursorY - fontSize,
          maxWidth: CONTENT_W,
          align: p.align,
          font: activeFont,
          fontSize,
        });
        cursorY -= lineStep;
      }
    }

    if (p.lines.length > 0 || p.imagePaths.length > 0) {
      cursorY -= 3;
    }
  };

  const measureAndRenderTable = (table: ParsedTable) => {
    const headerRows = table.rows.filter((r) => r.isHeader);
    const hasExplicitSigInTable = table.rows.some((r) =>
      r.cells.some((c) =>
        c.paragraphs.some((p) => p.imagePaths.some((ip) => mediaCache.get(ip)?.isSignature)),
      ),
    );
    const isAssessorSigSection = table.rows.some((r) =>
      r.cells.some((c) =>
        c.paragraphs.some((p) =>
          p.lines.some((l) => /tanda\s*tangan\s*(?:asesor|peserta)|aspek\s+negatif\s+dan\s+positif/i.test(l)),
        ),
      ),
    );

    if (
      (hasExplicitSigInTable || isAssessorSigSection) &&
      pdfDoc.getPageCount() === 1 &&
      cursorY < TOP_Y - 120 &&
      (hasExplicitSigInTable || mediaCache.size > 0)
    ) {
      startNewPage();
    }

    const prepareRowLayout = (row: ParsedRow) => {
      let colCursor = 0;
      const cellLayouts = row.cells.map((cell) => {
        const cellW = resolveSpanWidth(table.colWidths, colCursor, cell.gridSpan);
        const cellX =
          MARGIN_X +
          table.colWidths.slice(0, colCursor).reduce((sum, w) => sum + w, 0);
        colCursor += cell.gridSpan;

        const innerW = Math.max(12, cellW - CELL_PAD_X * 2);
        const paragraphBlocks = cell.paragraphs.map((p) => {
          const activeFont = p.bold ? fontBold : fontRegular;
          const wrappedLines = p.lines.flatMap((l) =>
            wrapLineTokens(l, activeFont, CELL_FONT_SIZE, innerW),
          );
          const imgs = p.imagePaths
            .map((ip) => mediaCache.get(ip))
            .filter((a): a is EmbeddedAsset => Boolean(a));
          return {
            align: p.align,
            font: activeFont,
            wrappedLines,
            imgs,
            pageBreakBefore: p.pageBreakBefore,
          };
        });

        let textH = 0;
        let imgH = 0;
        for (const pb of paragraphBlocks) {
          textH += pb.wrappedLines.length * (CELL_FONT_SIZE + 2.5);
          for (const asset of pb.imgs) {
            const maxW = Math.min(innerW, asset.isSignature ? 95 : 58);
            const maxH = asset.isSignature ? 40 : 34;
            const scale = Math.min(maxW / asset.image.width, maxH / asset.image.height, 1);
            imgH += asset.image.height * scale + 3;
          }
        }

        const totalH = Math.max(
          16,
          CELL_PAD_Y * 2 + textH + imgH + (paragraphBlocks.length > 1 ? 2 : 0),
        );

        return {
          cell,
          cellX,
          cellW,
          innerW,
          paragraphBlocks,
          totalH,
        };
      });

      const rowHeight = Math.min(
        PAGE_H - 140,
        Math.max(16, ...cellLayouts.map((cl) => cl.totalH)),
      );
      return { cellLayouts, rowHeight };
    };

    const drawPreparedRow = (layout: ReturnType<typeof prepareRowLayout>) => {
      const rowTop = cursorY;
      const rowBottom = rowTop - layout.rowHeight;

      for (const cl of layout.cellLayouts) {
        if (cl.cell.fillRgb) {
          const [r, g, b] = cl.cell.fillRgb;
          page.drawRectangle({
            x: cl.cellX,
            y: rowBottom,
            width: cl.cellW,
            height: layout.rowHeight,
            color: rgb(r, g, b),
          });
        }

        if (table.hasBorders) {
          page.drawRectangle({
            x: cl.cellX,
            y: rowBottom,
            width: cl.cellW,
            height: layout.rowHeight,
            borderColor: rgb(0.45, 0.5, 0.56),
            borderWidth: 0.5,
          });
        }

        let cellY = rowTop - CELL_PAD_Y;
        for (const pb of cl.paragraphBlocks) {
          for (const asset of pb.imgs) {
            const maxW = Math.min(cl.innerW, asset.isSignature ? 95 : 58);
            const maxH = asset.isSignature ? 40 : 34;
            const scale = Math.min(maxW / asset.image.width, maxH / asset.image.height, 1);
            const drawW = asset.image.width * scale;
            const drawH = asset.image.height * scale;
            if (cellY - drawH >= rowBottom + 1) {
              page.drawImage(asset.image, {
                x: cl.cellX + CELL_PAD_X,
                y: cellY - drawH,
                width: drawW,
                height: drawH,
              });
              if (asset.isSignature) renderedSignatureOnPage = true;
            }
            cellY -= drawH + 3;
          }

          for (const tokens of pb.wrappedLines) {
            if (cellY - CELL_FONT_SIZE < rowBottom + 1.5) break;
            drawTokenLine({
              page,
              tokens,
              x: cl.cellX + CELL_PAD_X,
              y: cellY - CELL_FONT_SIZE,
              maxWidth: cl.innerW,
              align: pb.align,
              font: pb.font,
              fontSize: CELL_FONT_SIZE,
            });
            cellY -= CELL_FONT_SIZE + 2.5;
          }
        }
      }

      cursorY = rowBottom;
    };

    for (let rIdx = 0; rIdx < table.rows.length; rIdx += 1) {
      const row = table.rows[rIdx];
      if (!row) continue;

      const hasExplicitBreak = row.cells.some((c) =>
        c.paragraphs.some((p) => p.pageBreakBefore),
      );
      if (hasExplicitBreak && cursorY < TOP_Y - 10) {
        startNewPage();
      }

      const layout = prepareRowLayout(row);
      if (cursorY - layout.rowHeight < BOTTOM_SAFE_Y) {
        startNewPage();
        if (!row.isHeader && headerRows.length > 0) {
          for (const hRow of headerRows) {
            const hLayout = prepareRowLayout(hRow);
            if (cursorY - hLayout.rowHeight >= BOTTOM_SAFE_Y) {
              drawPreparedRow(hLayout);
            }
          }
        }
      }

      drawPreparedRow(layout);
    }

    cursorY -= 6;
  };

  for (const block of blocks) {
    if (block.kind === "tbl") {
      measureAndRenderTable(block.table);
    } else {
      renderStandaloneParagraph(block.paragraph);
    }
  }

  // Fallback for standalone custom templates storing word/media/signature.* without <a:blip>
  const signatureAsset = [...mediaCache.values()].find((a) => a.isSignature);
  if (signatureAsset && !renderedSignatureOnPage) {
    if (pdfDoc.getPageCount() === 1) {
      startNewPage();
    }
    const maxW = 115;
    const maxH = 50;
    const scale = Math.min(
      maxW / signatureAsset.image.width,
      maxH / signatureAsset.image.height,
      1,
    );
    const drawW = signatureAsset.image.width * scale;
    const drawH = signatureAsset.image.height * scale;
    if (cursorY - drawH < BOTTOM_SAFE_Y) startNewPage();
    page.drawImage(signatureAsset.image, {
      x: MARGIN_X,
      y: Math.max(BOTTOM_SAFE_Y + 6, cursorY - drawH),
      width: drawW,
      height: drawH,
    });
  }

  drawPageFooters(pdfDoc, fontRegular, fontBold);

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
