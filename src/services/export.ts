import fs from "node:fs";
import path from "node:path";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage, type PDFFont } from "pdf-lib";
import {
  formatAk05DateIndonesia,
  formatAk05SchemeTitle,
} from "@/lib/ak05/format";
import { AK05_LAYOUT } from "@/lib/ak05/layout";
import type {
  SchemeKelompokSpec,
  SchemeRecord,
} from "@/repositories/schemes.repository";

export type DocumentType = "ak05" | "ak02" | "ia04b" | "ia04a" | "ia06" | "dit_pack" | "similarity";
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
    recommendation: "K" | "BK" | "-";
    keterangan: string;
  }>;
  notesPositiveNegative: string;
  notesRejection: string;
  notesImprovement: string;
  signaturePngBytes?: Buffer;
  signatureMimeType?: "image/png" | "image/jpeg";
  templateBuffer?: Buffer;
}

export type Ak02EvidenceType =
  | "observasi"
  | "portofolio"
  | "pihak_ketiga"
  | "lisan"
  | "tertulis"
  | "proyek"
  | "lainnya";

export interface Ak02ExportPayload {
  schemeTitle: string;
  schemeNumber: string;
  tukType: "sewaktu" | "tempat_kerja" | "mandiri";
  assessorName: string;
  assessorRegNo: string;
  assesseeName: string;
  assessmentDate: string;
  endDate?: string;
  unitDecisions: Array<{
    unitCode?: string;
    unitTitle: string;
    evidenceTypes: Ak02EvidenceType[];
  }>;
  overallRecommendation: "K" | "BK" | null;
  decisionSource?: "auto_rollup" | "manual_override" | "undecided";
  overrideReason?: string | null;
  followUpNote?: string;
  assessorComment?: string;
  signaturePngBytes?: Buffer;
  signatureMimeType?: "image/png" | "image/jpeg";
  templateBuffer?: Buffer;
}

export interface Ia04bExportPayload {
  schemeCode?: string;
  schemeTitle: string;
  schemeNumber: string;
  tukType: "sewaktu" | "tempat_kerja" | "mandiri";
  assessorName: string;
  assessorRegNo: string;
  assesseeName: string;
  assessmentDate: string;
  kelompokPekerjaan?: SchemeKelompokSpec[];
  itemAchievedFlags: Array<boolean | null>;
  overallRecommendation: "K" | "BK" | null;
  signaturePngBytes?: Buffer;
  signatureMimeType?: "image/png" | "image/jpeg";
  templateBuffer?: Buffer;
}

export interface Ia06cExportPayload {
  schemeTitle: string;
  schemeNumber: string;
  tukType: "sewaktu" | "tempat_kerja" | "mandiri";
  assessorName: string;
  assessorRegNo: string;
  assesseeName: string;
  assessmentDate: string;
  durationText?: string;
  answers: Array<{
    questionNo: number;
    answerText: string;
    achieved: boolean | null;
  }>;
  overallAchieved: boolean | null;
  feedbackDetail?: string;
  signaturePngBytes?: Buffer;
  signatureMimeType?: "image/png" | "image/jpeg";
  templateBuffer?: Buffer;
}

export interface Ia04aExportPayload {
  schemeTitle: string;
  schemeNumber: string;
  tukType: "sewaktu" | "tempat_kerja" | "mandiri";
  assessorName: string;
  assessorRegNo: string;
  assesseeName: string;
  assessmentDate: string;
  ditExtractedText?: string | null;
  modelAnswers: Array<{
    no: number | string;
    question: string;
    keyPoints: string[];
  }>;
  readiness?: string | null;
  templateBuffer?: Buffer;
}

function loadAk3uTemplateBuffer(fileName: string): Buffer {
  const safeBase = path.basename(fileName);
  return fs.readFileSync(path.join(process.cwd(), "src", "templates", "ak3u", safeBase));
}

/**
 * Resolves the active `.docx` blanko template buffer for a (scheme, form) pair from the
 * scheme's `scheme_form_manifests` registry (Supabase Storage `scheme-blankos` or `builtin://ak3u/`),
 * falling back to the base BNSP template structure when no custom upload exists yet.
 */
export async function resolveSchemeTemplateBuffer(params: {
  scheme?: SchemeRecord | null;
  formKeys: string[];
  instrumentRoles?: string[];
  defaultAk3uFileName: string;
  downloadFromStorage?: (storagePath: string) => Promise<Buffer | undefined>;
}): Promise<Buffer> {
  const forms = params.scheme?.forms ?? [];
  const keySet = new Set(params.formKeys.map((k) => k.trim().toLowerCase()));
  const roleSet = new Set((params.instrumentRoles ?? []).map((r) => r.trim().toLowerCase()));

  const matched =
    forms.find(
      (f) =>
        keySet.has(f.formKey.trim().toLowerCase()) &&
        Boolean(f.templateStoragePath),
    ) ??
    forms.find(
      (f) =>
        roleSet.has(f.instrumentRole.trim().toLowerCase()) &&
        Boolean(f.templateStoragePath),
    );

  const storagePath = matched?.templateStoragePath?.trim();
  if (storagePath) {
    if (storagePath.startsWith("builtin://")) {
      const rel = storagePath.slice("builtin://".length);
      const parts = rel.split("/").filter(Boolean);
      const folder = path.basename(parts[0] ?? "ak3u");
      const builtinName = path.basename(parts[1] ?? parts[0] ?? "");
      try {
        return fs.readFileSync(
          path.join(process.cwd(), "src", "templates", folder, builtinName),
        );
      } catch {
        // Fall through to defaultAk3uFileName
      }
    } else if (params.downloadFromStorage) {
      try {
        const downloaded = await params.downloadFromStorage(storagePath);
        if (downloaded && downloaded.length > 0) {
          return downloaded;
        }
      } catch {
        // Fall through to default template buffer
      }
    }
  }

  return loadAk3uTemplateBuffer(params.defaultAk3uFileName);
}

function applyPlaceholderTokens(
  xml: string,
  tokens: Record<string, string | undefined>,
): string {
  let result = xml;
  for (const [key, val] of Object.entries(tokens)) {
    if (val === undefined) continue;
    const token = `{{${key}}}`;
    if (result.includes(token)) {
      result = result.split(token).join(escapeXml(val));
    }
  }
  return result;
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

function buildTukCellRuns(tukType?: Ak05ExportPayload["tukType"]): string {
  const active = tukType === "tempat_kerja" || tukType === "mandiri" ? tukType : "sewaktu";
  return [
    makeTextRun("Sewaktu", { strike: active !== "sewaktu" }),
    makeTextRun("/"),
    makeTextRun("Tempat Kerja", { strike: active !== "tempat_kerja" }),
    makeTextRun("/"),
    makeTextRun("Mandiri*", { strike: active !== "mandiri" }),
  ].join("");
}

function buildSignatureDrawingRun(relId: string, imageName: string): string {
  // 100 x 45 pt in EMU (1 pt = 12700 EMU) -> scaled conservatively 952500 x 428625
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

async function embedSignatureInZip(
  zip: JSZip,
  signatureBytes?: Buffer,
  signatureMime?: "image/png" | "image/jpeg",
): Promise<{ hasEmbeddedSig: boolean; sigExt: "png" | "jpg" }> {
  if (!signatureBytes || signatureBytes.length === 0) {
    return { hasEmbeddedSig: false, sigExt: "png" };
  }

  const sigExt = detectSignatureImageType(signatureBytes, signatureMime);
  zip.file(`word/media/signature.${sigExt}`, signatureBytes);

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

  // Ensure Content_Types declares the image extension (e.g. FR.IA.06C starts with zero media).
  const ctFile = zip.file("[Content_Types].xml");
  if (ctFile) {
    let ctXml = await ctFile.async("string");
    const ctEntry =
      sigExt === "jpg"
        ? { ext: "jpg", contentType: "image/jpeg" }
        : { ext: "png", contentType: "image/png" };
    const hasExt =
      ctXml.includes(`Extension="${ctEntry.ext}"`) ||
      (sigExt === "jpg" && ctXml.includes('Extension="jpeg"'));
    if (!hasExt || (sigExt === "jpg" && !ctXml.includes('Extension="jpg"'))) {
      ctXml = ctXml.replace(
        "</Types>",
        `<Default Extension="${ctEntry.ext}" ContentType="${ctEntry.contentType}"/></Types>`,
      );
      zip.file("[Content_Types].xml", ctXml);
    }
  }

  return { hasEmbeddedSig: true, sigExt };
}

function toggleSdtCheckboxXml(sdtXml: string, checked: boolean): string {
  const val = checked ? "1" : "0";
  const symbol = checked ? "☑" : "☐";
  let next = sdtXml.replace(/<w14:checked(?:\s+w14:val="[01]")?\s*\/>/g, `<w14:checked w14:val="${val}"/>`);
  if (checked) {
    next = next.replace(
      /<w14:checkedState[^>]*\/>/g,
      `<w14:checkedState w14:val="2611" w14:font="MS Gothic"/>`,
    );
  }
  const contentStart = next.indexOf("<w:sdtContent>");
  if (contentStart !== -1) {
    const head = next.slice(0, contentStart);
    const tail = next.slice(contentStart).replace(/<w:t[^>]*>[☐☑]?<\/w:t>/g, `<w:t>${symbol}</w:t>`);
    next = head + tail;
  }
  return next;
}

function mutateSdtCheckboxes(xmlSlice: string, checkedFlags: boolean[]): string {
  const spans = findTopLevelTags(xmlSlice, "w:sdt");
  let result = xmlSlice;
  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i];
    if (!span || i >= checkedFlags.length) continue;
    const orig = xmlSlice.slice(span.start, span.end);
    const updated = toggleSdtCheckboxXml(orig, Boolean(checkedFlags[i]));
    if (updated !== orig) {
      result = result.slice(0, span.start) + updated + result.slice(span.end);
    }
  }
  return result;
}

function applyTableReplacements(
  docXml: string,
  replacements: Array<{ span: XmlSpan; xml: string }>,
): string {
  const sorted = [...replacements].sort((a, b) => b.span.start - a.span.start);
  let nextDocXml = docXml;
  for (const rep of sorted) {
    nextDocXml =
      nextDocXml.slice(0, rep.span.start) + rep.xml + nextDocXml.slice(rep.span.end);
  }
  return nextDocXml;
}

function fillCommonSchemeAndTukRow(
  rowXml: string,
  rIdx: number,
  params: {
    displaySchemeTitle: string;
    schemeNumber: string;
    tukType: "sewaktu" | "tempat_kerja" | "mandiri";
    assessorName: string;
  },
): string {
  if (rIdx === 0) {
    if (
      !params.displaySchemeTitle ||
      params.displaySchemeTitle === "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM"
    ) {
      return rowXml;
    }
    return mutateRowCells(rowXml, (cXml, cIdx) =>
      cIdx === 3
        ? replaceCellRuns(cXml, makeTextRun(params.displaySchemeTitle, { bold: true }))
        : cXml,
    );
  }
  if (rIdx === 1) {
    const num = params.schemeNumber.trim();
    if (!num || num === "-" || num.toUpperCase() === "SKM/2037/00013/2/2021/1") {
      return rowXml;
    }
    return mutateRowCells(rowXml, (cXml, cIdx) =>
      cIdx === 3 ? replaceCellRuns(cXml, makeTextRun(num, { bold: true })) : cXml,
    );
  }
  if (rIdx === 2) {
    return mutateRowCells(rowXml, (cXml, cIdx) =>
      cIdx === 2 ? replaceCellRuns(cXml, buildTukCellRuns(params.tukType)) : cXml,
    );
  }
  if (rIdx === 3) {
    return mutateRowCells(rowXml, (cXml, cIdx) =>
      cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(params.assessorName)) : cXml,
    );
  }
  return rowXml;
}

function buildAssessorSigRuns(params: {
  hasEmbeddedSig: boolean;
  sigExt: "png" | "jpg";
  displayDate: string;
}): string {
  return params.hasEmbeddedSig
    ? `${buildSignatureDrawingRun("rIdSig1", `signature.${params.sigExt}`)}<w:r><w:br/></w:r>${makeTextRun(params.displayDate)}`
    : makeTextRun(params.displayDate);
}

function fillAssesseeAndAssessorSigRows(
  rows: string[],
  params: {
    startOffset: number;
    assesseeName: string;
    assessorName: string;
    assessorRegNo: string;
    displayDate: string;
    hasEmbeddedSig: boolean;
    sigExt: "png" | "jpg";
  },
): string[] {
  const o = params.startOffset;
  return rows.map((rowXml, rIdx) => {
    if (rIdx === o + 1) {
      return mutateRowCells(rowXml, (cXml, cIdx) =>
        cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(params.assesseeName)) : cXml,
      );
    }
    if (rIdx === o + 2) {
      return mutateRowCells(rowXml, (cXml, cIdx) =>
        cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(params.displayDate)) : cXml,
      );
    }
    if (rIdx === o + 4) {
      return mutateRowCells(rowXml, (cXml, cIdx) =>
        cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(params.assessorName)) : cXml,
      );
    }
    if (rIdx === o + 5) {
      return mutateRowCells(rowXml, (cXml, cIdx) =>
        cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(params.assessorRegNo)) : cXml,
      );
    }
    if (rIdx === o + 6) {
      const sigRuns = buildAssessorSigRuns(params);
      return mutateRowCells(rowXml, (cXml, cIdx) =>
        cIdx === 2 ? replaceCellRuns(cXml, sigRuns) : cXml,
      );
    }
    return rowXml;
  });
}

/**
 * Normalises blanko OOXML layout bugs adapted from MUK DOCX generator checks:
 * 1) Prevents header textbox labels (`FR.IA.04B`, etc.) from wrapping awkwardly (`wrap="none"`).
 * 2) Fixes negative top/bottom page margin attributes that trigger viewer layout warnings.
 */
export function normalizeBlankoXmlForExport(params: {
  docXml: string;
  headerXml?: string;
}): { docXml: string; headerXml?: string } {
  const fixedDocXml = params.docXml.replace(
    /<w:pgMar\b[^>]+>/gi,
    (tag) => tag.replace(/\b(w:(?:top|bottom))="-(\d+)"/gi, '$1="$2"'),
  );
  const fixedHeaderXml = params.headerXml
    ? params.headerXml.replace(
        /<(?:a|wps):bodyPr\b[^>]+>/gi,
        (tag) => tag.replace(/\bwrap="(?:square|topAndBottom)"/gi, 'wrap="none"'),
      )
    : undefined;
  return { docXml: fixedDocXml, headerXml: fixedHeaderXml };
}

async function loadDocxTemplateAndSig(params: {
  fileName: string;
  templateBuffer?: Buffer;
  label: string;
  expectedTables: number;
  allowFlexibleTableCount?: boolean;
  signatureBytes?: Buffer;
  signatureMime?: "image/png" | "image/jpeg";
}) {
  const rawBuffer = params.templateBuffer ?? loadAk3uTemplateBuffer(params.fileName);
  const zip = await JSZip.loadAsync(rawBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error(`TEMPLATE_ERROR: word/document.xml tidak ditemukan di blanko ${params.label}.`);
  }
  const rawDocXml = await docFile.async("string");
  const { docXml } = normalizeBlankoXmlForExport({ docXml: rawDocXml });

  const headerFiles = zip.file(/^word\/header\d*\.xml$/i);
  await Promise.all(
    headerFiles.map(async (hf) => {
      const rawHeader = await hf.async("string");
      const { headerXml } = normalizeBlankoXmlForExport({
        docXml: "",
        headerXml: rawHeader,
      });
      if (headerXml && headerXml !== rawHeader) {
        zip.file(hf.name, headerXml);
      }
    }),
  );

  const tableSpans = findTopLevelTags(docXml, "w:tbl");
  if (!params.allowFlexibleTableCount && tableSpans.length < params.expectedTables) {
    throw new Error(
      `TEMPLATE_ERROR: Blanko ${params.label} tidak valid (ditemukan ${tableSpans.length} tabel, diharapkan ${params.expectedTables}).`,
    );
  }
  const sig = await embedSignatureInZip(zip, params.signatureBytes, params.signatureMime);
  return { zip, docXml, tableSpans, ...sig };
}

/**
 * Generates FR.IA.04A (Instruksi DIT) DOCX. Builds a clean structured document
 * from the DIT analysis output (instruksi teks + jawaban model per soal) using
 * the `docx` library, since the official blanko template is a filled sample
 * without replaceable placeholder tokens.
 */
export async function generateIa04aDocx(payload: Ia04aExportPayload): Promise<Buffer> {
  const displayDate = formatAk05DateIndonesia(payload.assessmentDate);
  const displaySchemeTitle = formatAk05SchemeTitle(payload.schemeTitle);

  const children = [];

  children.push(
    new Paragraph({
      text: "Lembar Instruksi Tugas Terstruktur (DIT) — FR.IA.04A",
      heading: HeadingLevel.TITLE,
      alignment: "center",
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: `${displaySchemeTitle} (${payload.schemeNumber})`,
      alignment: "center",
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "LSP / TUK: ", bold: true }),
        new TextRun({ text: `${payload.assessorName} (${payload.tukType})` }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Asesi: ", bold: true }),
        new TextRun({ text: payload.assesseeName }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Tanggal Asesmen: ", bold: true }),
        new TextRun({ text: displayDate }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Nomor Skema: ", bold: true }),
        new TextRun({ text: payload.schemeNumber }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Kesiapan (Readiness): ", bold: true }),
        new TextRun({ text: payload.readiness ?? "-" }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: "Bahan Instruksi (Ekstraksi FR.IA.04A)",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 80 },
    }),
    ...(payload.ditExtractedText
      ? payload.ditExtractedText.split(/\n+/).map(
          (line) => new Paragraph({ text: line, spacing: { after: 60 } }),
        )
      : [new Paragraph({ text: "Tidak ada teks instruksi yang tersedia.", spacing: { after: 60 } })]),
    new Paragraph({
      text: "Jawaban Model (untuk Asesor)",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 80 },
    }),
    ...payload.modelAnswers.map(
      (qa) =>
        new Paragraph({
          children: [
            new TextRun({ text: `Soal ${qa.no}. `, bold: true }),
            new TextRun({ text: qa.question }),
          ],
          spacing: { before: 120, after: 40 },
        }),
    ),
    ...payload.modelAnswers.flatMap((qa) =>
      qa.keyPoints.map(
        (pt, i) =>
          new Paragraph({
            text: `   ${i + 1}. ${pt}`,
            bullet: { level: 0 },
            spacing: { after: 40 },
          }),
      ),
    ),
  );

  const doc = new Document({
    creator: "AsesorKompetensi",
    title: `FR.IA.04A - Instruksi DIT - ${payload.assesseeName}`,
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

const AK02_EVIDENCE_COLUMNS: Ak02EvidenceType[] = [
  "observasi",
  "portofolio",
  "pihak_ketiga",
  "lisan",
  "tertulis",
  "proyek",
  "lainnya",
];

/**
 * Generates FR.AK.05 DOCX by surgically template-filling the official BNSP blanko
 * (`src/templates/ak3u/FR.AK.05.LAPORAN_ASESMEN.docx`) without altering its 5 tables,
 * headers, footers, or styles.
 */
export async function generateAk05Docx(payload: Ak05ExportPayload): Promise<Buffer> {
  const { zip, docXml, tableSpans, hasEmbeddedSig, sigExt } = await loadDocxTemplateAndSig({
    fileName: "FR.AK.05.LAPORAN_ASESMEN.docx",
    templateBuffer: payload.templateBuffer,
    label: "FR.AK.05",
    expectedTables: 5,
    allowFlexibleTableCount: Boolean(payload.templateBuffer),
    signatureBytes: payload.signaturePngBytes,
    signatureMime: payload.signatureMimeType,
  });

  const displaySchemeTitle = formatAk05SchemeTitle(payload.schemeTitle);
  const displayDate = formatAk05DateIndonesia(payload.assessmentDate);

  if (tableSpans.length < 5) {
    const tokenized = applyPlaceholderTokens(docXml, {
      SCHEME_CODE: payload.schemeCode,
      SCHEME_TITLE: displaySchemeTitle,
      SCHEME_NUMBER: payload.schemeNumber,
      TUK_NAME: payload.tukName ?? "-",
      TUK_TYPE: payload.tukType,
      ASSESSOR_NAME: payload.assessorName,
      ASSESSOR_REG_NO: payload.assessorRegNo,
      ASSESSMENT_DATE: displayDate,
      NOTES_POSITIVE_NEGATIVE: payload.notesPositiveNegative || "-",
      NOTES_REJECTION: payload.notesRejection || "-",
      NOTES_IMPROVEMENT: payload.notesImprovement || "-",
    });
    zip.file("word/document.xml", tokenized);
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }

  // Table 1: Metadata (Judul, Nomor, TUK, Nama Asesor, Tanggal)
  const t1Span = tableSpans[1]!;
  const updatedT1 = mutateTableRows(docXml.slice(t1Span.start, t1Span.end), (rows) =>
    rows.map((rowXml, rIdx) => {
      if (rIdx <= 3) {
        return fillCommonSchemeAndTukRow(rowXml, rIdx, {
          displaySchemeTitle,
          schemeNumber: payload.schemeNumber,
          tukType: payload.tukType,
          assessorName: payload.assessorName,
        });
      }
      if (rIdx === 4) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(displayDate)) : cXml,
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
        const sigRuns = buildAssessorSigRuns({ hasEmbeddedSig, sigExt, displayDate });
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, sigRuns) : cXml,
        );
      }
      return rowXml;
    }),
  );

  const nextDocXml = applyTableReplacements(docXml, [
    { span: t4Span, xml: updatedT4 },
    { span: t3Span, xml: updatedT3 },
    { span: t2Span, xml: updatedT2 },
    { span: t1Span, xml: updatedT1 },
  ]);

  zip.file("word/document.xml", nextDocXml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/**
 * Generates FR.AK.02 (Rekaman Asesmen Kompetensi) DOCX directly from official BNSP blanko
 * (`src/templates/ak3u/FR.AK.02.REKAMAN_ASESMEN.docx`) without altering layout or styles.
 */
export async function generateAk02Docx(payload: Ak02ExportPayload): Promise<Buffer> {
  const { zip, docXml, tableSpans, hasEmbeddedSig, sigExt } = await loadDocxTemplateAndSig({
    fileName: "FR.AK.02.REKAMAN_ASESMEN.docx",
    templateBuffer: payload.templateBuffer,
    label: "FR.AK.02",
    expectedTables: 4,
    allowFlexibleTableCount: Boolean(payload.templateBuffer),
    signatureBytes: payload.signaturePngBytes,
    signatureMime: payload.signatureMimeType,
  });

  const displaySchemeTitle = formatAk05SchemeTitle(payload.schemeTitle);
  const displayDate = formatAk05DateIndonesia(payload.assessmentDate);
  const displayEndDate = formatAk05DateIndonesia(payload.endDate ?? payload.assessmentDate);

  if (tableSpans.length < 4) {
    const tokenized = applyPlaceholderTokens(docXml, {
      SCHEME_TITLE: displaySchemeTitle,
      SCHEME_NUMBER: payload.schemeNumber,
      TUK_TYPE: payload.tukType,
      ASSESSOR_NAME: payload.assessorName,
      ASSESSOR_REG_NO: payload.assessorRegNo,
      ASSESSEE_NAME: payload.assesseeName,
      ASSESSMENT_DATE: displayDate,
      RECOMMENDATION: payload.overallRecommendation ?? "-",
      FOLLOW_UP_NOTE: payload.followUpNote || "-",
      ASSESSOR_COMMENT: payload.assessorComment || "-",
    });
    zip.file("word/document.xml", tokenized);
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }

  // Table 1: Header metadata
  const t1Span = tableSpans[1]!;
  const updatedT1 = mutateTableRows(docXml.slice(t1Span.start, t1Span.end), (rows) =>
    rows.map((rowXml, rIdx) => {
      if (rIdx <= 3) {
        return fillCommonSchemeAndTukRow(rowXml, rIdx, {
          displaySchemeTitle,
          schemeNumber: payload.schemeNumber,
          tukType: payload.tukType,
          assessorName: payload.assessorName,
        });
      }
      if (rIdx === 4) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(payload.assesseeName)) : cXml,
        );
      }
      if (rIdx === 5) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 3 ? replaceCellRuns(cXml, makeTextRun(displayDate)) : cXml,
        );
      }
      if (rIdx === 6) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 3 ? replaceCellRuns(cXml, makeTextRun(displayEndDate)) : cXml,
        );
      }
      return rowXml;
    }),
  );

  const isDefaultAk3uUnits =
    payload.unitDecisions.length === 13 &&
    payload.unitDecisions[0]?.unitTitle ===
      "Merancang Strategi Pengendalian Risiko K3 di Tempat Kerja";

  // Table 2: Evidence matrix (dynamic units + Rekomendasi + Tindak lanjut + Komentar)
  const t2Span = tableSpans[2]!;
  const updatedT2 = mutateTableRows(docXml.slice(t2Span.start, t2Span.end), (rows) => {
    if (isDefaultAk3uUnits && rows.length === 17) {
      return rows.map((rowXml, rIdx) => {
        if (rIdx >= 1 && rIdx <= 13) {
          const unit = payload.unitDecisions[rIdx - 1];
          const evidenceSet = new Set(unit?.evidenceTypes ?? []);
          return mutateRowCells(rowXml, (cXml, cIdx) => {
            if (cIdx >= 1 && cIdx <= 7) {
              const evKey = AK02_EVIDENCE_COLUMNS[cIdx - 1];
              return replaceCellRuns(
                cXml,
                makeTextRun(evKey && evidenceSet.has(evKey) ? "☑" : ""),
              );
            }
            return cXml;
          });
        }
        if (rIdx === 14) {
          const isK = payload.overallRecommendation === "K";
          const isBk = payload.overallRecommendation === "BK";
          return mutateSdtCheckboxes(rowXml, [isK, isBk]);
        }
        if (rIdx === 15) {
          return mutateRowCells(rowXml, (cXml, cIdx) =>
            cIdx === 1
              ? replaceCellRuns(cXml, makeTextRun(payload.followUpNote || "-"))
              : cXml,
          );
        }
        if (rIdx === 16) {
          return mutateRowCells(rowXml, (cXml, cIdx) =>
            cIdx === 1
              ? replaceCellRuns(
                  cXml,
                  makeTextRun(payload.assessorComment || "-"),
                )
              : cXml,
          );
        }
        return rowXml;
      });
    }

    const headerRow = rows[0] ?? "";
    const footerStart = Math.max(1, rows.length - 3);
    const unitTplRows = rows.slice(1, footerStart);
    const footerRows = rows.slice(footerStart);
    const cloneUnitTpl = (
      unitTplRows[unitTplRows.length - 1] ??
      unitTplRows[0] ??
      ""
    ).replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, "");

    const dynamicUnitRows = payload.unitDecisions.map((unit, idx) => {
      const baseRow = unitTplRows[idx] ?? cloneUnitTpl;
      const evidenceSet = new Set(unit.evidenceTypes ?? []);
      const unitLabel = unit.unitCode
        ? `${idx + 1}. ${unit.unitCode} — ${unit.unitTitle}`
        : `${idx + 1}. ${unit.unitTitle}`;
      return mutateRowCells(baseRow, (cXml, cIdx) => {
        if (cIdx === 0) {
          return replaceCellRuns(cXml, makeTextRun(unitLabel));
        }
        if (cIdx >= 1 && cIdx <= 7) {
          const evKey = AK02_EVIDENCE_COLUMNS[cIdx - 1];
          return replaceCellRuns(
            cXml,
            makeTextRun(evKey && evidenceSet.has(evKey) ? "☑" : ""),
          );
        }
        return cXml;
      });
    });

    const updatedFooterRows = footerRows.map((rowXml, fIdx) => {
      if (fIdx === 0) {
        const isK = payload.overallRecommendation === "K";
        const isBk = payload.overallRecommendation === "BK";
        return mutateSdtCheckboxes(rowXml, [isK, isBk]);
      }
      if (fIdx === 1) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 1
            ? replaceCellRuns(cXml, makeTextRun(payload.followUpNote || "-"))
            : cXml,
        );
      }
      if (fIdx === 2) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 1
            ? replaceCellRuns(cXml, makeTextRun(payload.assessorComment || "-"))
            : cXml,
        );
      }
      return rowXml;
    });

    return [headerRow, ...dynamicUnitRows, ...updatedFooterRows];
  });

  // Table 3: Signature block (Asesi + Asesor)
  const t3Span = tableSpans[3]!;
  const updatedT3 = mutateTableRows(docXml.slice(t3Span.start, t3Span.end), (rows) =>
    fillAssesseeAndAssessorSigRows(rows, {
      startOffset: 0,
      assesseeName: payload.assesseeName,
      assessorName: payload.assessorName,
      assessorRegNo: payload.assessorRegNo,
      displayDate,
      hasEmbeddedSig,
      sigExt,
    }),
  );

  const nextDocXml = applyPlaceholderTokens(
    applyTableReplacements(docXml, [
      { span: t3Span, xml: updatedT3 },
      { span: t2Span, xml: updatedT2 },
      { span: t1Span, xml: updatedT1 },
    ]),
    {
      SCHEME_TITLE: displaySchemeTitle,
      SCHEME_NUMBER: payload.schemeNumber,
      TUK_TYPE: payload.tukType,
      ASSESSOR_NAME: payload.assessorName,
      ASSESSOR_REG_NO: payload.assessorRegNo,
      ASSESSEE_NAME: payload.assesseeName,
      ASSESSMENT_DATE: displayDate,
      RECOMMENDATION: payload.overallRecommendation ?? "-",
      FOLLOW_UP_NOTE: payload.followUpNote || "-",
      ASSESSOR_COMMENT: payload.assessorComment || "-",
    },
  );

  zip.file("word/document.xml", nextDocXml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/**
 * Generates FR.IA.04B (DIT - Penilaian Proyek Singkat) DOCX directly from official BNSP blanko
 * (`src/templates/ak3u/FR.IA.04B.PENILAIAN_PROYEK_SINGKAT.docx`), preserving all KP tables
 * and toggling native Word <w:sdt> Ya/Tidak checkboxes.
 */
export async function generateIa04bDocx(payload: Ia04bExportPayload): Promise<Buffer> {
  const { zip, docXml, tableSpans, hasEmbeddedSig, sigExt } = await loadDocxTemplateAndSig({
    fileName: "FR.IA.04B.PENILAIAN_PROYEK_SINGKAT.docx",
    templateBuffer: payload.templateBuffer,
    label: "FR.IA.04B",
    expectedTables: 13,
    allowFlexibleTableCount: Boolean(payload.templateBuffer),
    signatureBytes: payload.signaturePngBytes,
    signatureMime: payload.signatureMimeType,
  });

  const displaySchemeTitle = formatAk05SchemeTitle(payload.schemeTitle);
  const displayDate = formatAk05DateIndonesia(payload.assessmentDate);
  const replacements: Array<{ span: XmlSpan; xml: string }> = [];

  if (tableSpans.length < 13) {
    const checkboxFlags: boolean[] = [];
    for (const rawFlag of payload.itemAchievedFlags) {
      const achieved =
        rawFlag === undefined
          ? payload.overallRecommendation === "K"
            ? true
            : payload.overallRecommendation === "BK"
              ? false
              : null
          : rawFlag;
      checkboxFlags.push(achieved === true, achieved === false);
    }
    const withChecks = mutateSdtCheckboxes(docXml, checkboxFlags);
    const tokenized = applyPlaceholderTokens(withChecks, {
      SCHEME_TITLE: displaySchemeTitle,
      SCHEME_NUMBER: payload.schemeNumber,
      TUK_TYPE: payload.tukType,
      ASSESSOR_NAME: payload.assessorName,
      ASSESSOR_REG_NO: payload.assessorRegNo,
      ASSESSEE_NAME: payload.assesseeName,
      ASSESSMENT_DATE: displayDate,
      RECOMMENDATION: payload.overallRecommendation ?? "-",
    });
    zip.file("word/document.xml", tokenized);
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }

  // Table 1: Metadata
  const t1Span = tableSpans[1]!;
  const updatedT1 = mutateTableRows(docXml.slice(t1Span.start, t1Span.end), (rows) =>
    rows.map((rowXml, rIdx) => {
      if (rIdx <= 3) {
        return fillCommonSchemeAndTukRow(rowXml, rIdx, {
          displaySchemeTitle,
          schemeNumber: payload.schemeNumber,
          tukType: payload.tukType,
          assessorName: payload.assessorName,
        });
      }
      if (rIdx === 4) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(payload.assesseeName)) : cXml,
        );
      }
      if (rIdx === 5) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(displayDate)) : cXml,
        );
      }
      return rowXml;
    }),
  );
  replacements.push({ span: t1Span, xml: updatedT1 });

  const isCustomKelompok =
    Boolean(payload.kelompokPekerjaan && payload.kelompokPekerjaan.length > 0) &&
    ((Boolean(payload.schemeCode) && payload.schemeCode!.trim().toUpperCase() !== "AK3U") ||
      payload.kelompokPekerjaan!.length !== 4 ||
      payload.kelompokPekerjaan![0]?.units[0]?.code !== "M.71KKK01.001.1");

  // Tables 3..10: 4 Kelompok Pekerjaan pairs ([3,4], [5,6], [7,8], [9,10])
  let itemCursor = 0;
  if (!isCustomKelompok) {
    for (const tblIdx of [4, 6, 8, 10]) {
      const span = tableSpans[tblIdx]!;
      const updatedAspectTbl = mutateTableRows(docXml.slice(span.start, span.end), (rows) =>
        rows.map((rowXml, rIdx) => {
          if (rIdx < 2) return rowXml;
          const rawFlag = payload.itemAchievedFlags[itemCursor];
          const achieved =
            rawFlag === undefined
              ? payload.overallRecommendation === "K"
                ? true
                : payload.overallRecommendation === "BK"
                  ? false
                  : null
              : rawFlag;
          itemCursor += 1;
          return mutateSdtCheckboxes(rowXml, [achieved === true, achieved === false]);
        }),
      );
      replacements.push({ span, xml: updatedAspectTbl });
    }
  } else {
    const kpList = payload.kelompokPekerjaan ?? [];
    for (let kpPairIdx = 0; kpPairIdx < 4; kpPairIdx++) {
      const unitTblSpan = tableSpans[3 + kpPairIdx * 2]!;
      const aspectTblSpan = tableSpans[4 + kpPairIdx * 2]!;
      const kp = kpList[kpPairIdx];

      if (!kp) {
        replacements.push({ span: unitTblSpan, xml: "<w:p/>" });
        replacements.push({ span: aspectTblSpan, xml: "<w:p/>" });
        continue;
      }

      const updatedUnitTbl = mutateTableRows(
        docXml.slice(unitTblSpan.start, unitTblSpan.end),
        (rows) => {
          const headerRow = mutateRowCells(rows[0] ?? "", (cXml, cIdx) =>
            cIdx === 0 ? replaceCellRuns(cXml, makeTextRun(kp.title, { bold: true })) : cXml,
          );
          const bodyTemplates = rows.slice(1);
          const cloneRow = (
            bodyTemplates[bodyTemplates.length - 1] ??
            bodyTemplates[0] ??
            ""
          ).replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, "");
          const unitRows = kp.units.map((u, uIdx) => {
            const tpl = bodyTemplates[uIdx] ?? cloneRow;
            const cellCount = findTopLevelTags(tpl, "w:tc").length;
            return mutateRowCells(tpl, (cXml, cIdx) => {
              if (cIdx === cellCount - 3) return replaceCellRuns(cXml, makeTextRun(`${u.no}.`));
              if (cIdx === cellCount - 2) return replaceCellRuns(cXml, makeTextRun(u.code));
              if (cIdx === cellCount - 1) return replaceCellRuns(cXml, makeTextRun(u.title));
              return cXml;
            });
          });
          return [headerRow, ...unitRows];
        },
      );
      replacements.push({ span: unitTblSpan, xml: updatedUnitTbl });

      const updatedAspectTbl = mutateTableRows(
        docXml.slice(aspectTblSpan.start, aspectTblSpan.end),
        (rows) => {
          const headerRows = rows.slice(0, 2);
          const bodyTemplates = rows.slice(2);
          const cloneBase = (
            bodyTemplates[bodyTemplates.length - 1] ??
            bodyTemplates[0] ??
            ""
          ).replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, "");

          const aspectRows = kp.aspects.map((asp, aIdx) => {
            let rowTpl = bodyTemplates[aIdx];
            if (!rowTpl) {
              let sdtSeed = 820000 + kpPairIdx * 1000 + aIdx * 10;
              rowTpl = cloneBase.replace(
                /<w:id w:val="[^"]*"\/>/g,
                () => `<w:id w:val="${sdtSeed++}"/>`,
              );
            }
            const rawFlag = payload.itemAchievedFlags[itemCursor];
            const achieved =
              rawFlag === undefined
                ? payload.overallRecommendation === "K"
                  ? true
                  : payload.overallRecommendation === "BK"
                    ? false
                    : null
                : rawFlag;
            itemCursor += 1;

            const withText = mutateRowCells(rowTpl, (cXml, cIdx) => {
              if (cIdx === 0) return replaceCellRuns(cXml, makeTextRun(`${asp.no}.`));
              if (cIdx === 1) return replaceCellRuns(cXml, makeTextRun(asp.lingkup));
              if (cIdx === 2) {
                return replaceCellRuns(
                  cXml,
                  `${makeTextRun("Pertanyaan: ", { bold: true })}${makeTextRun(asp.question)}`,
                );
              }
              if (cIdx === 3) return replaceCellRuns(cXml, makeTextRun(asp.kukRef));
              return cXml;
            });
            return mutateSdtCheckboxes(withText, [achieved === true, achieved === false]);
          });

          return [...headerRows, ...aspectRows];
        },
      );
      replacements.push({ span: aspectTblSpan, xml: updatedAspectTbl });
    }
  }

  // Table 11: Recommendation + Asesi/Asesor signature block (offset = 1 below r0)
  const t11Span = tableSpans[11]!;
  const isK = payload.overallRecommendation === "K";
  const isBk = payload.overallRecommendation === "BK";
  const updatedT11 = mutateTableRows(docXml.slice(t11Span.start, t11Span.end), (rows) => {
    const withRec = rows.map((rowXml, rIdx) => {
      if (rIdx !== 0) return rowXml;
      const recRuns = [
        makeTextRun("Asesi telah "),
        makeTextRun("memenuhi", { strike: isBk }),
        makeTextRun("/ "),
        makeTextRun("belum memenuhi", { strike: isK }),
        makeTextRun(" pencapaian seluruh kriteria unjuk kerja, direkomendasikan: "),
        makeTextRun(isK ? "☑ " : "☐ "),
        makeTextRun("Kompeten  "),
        makeTextRun(isBk ? "☑ " : "☐ "),
        makeTextRun("Belum Kompeten"),
      ].join("");
      return mutateRowCells(rowXml, (cXml, cIdx) =>
        cIdx === 1 ? replaceCellRuns(cXml, recRuns) : cXml,
      );
    });
    return fillAssesseeAndAssessorSigRows(withRec, {
      startOffset: 1,
      assesseeName: payload.assesseeName,
      assessorName: payload.assessorName,
      assessorRegNo: payload.assessorRegNo,
      displayDate,
      hasEmbeddedSig,
      sigExt,
    });
  });
  replacements.push({ span: t11Span, xml: updatedT11 });

  const nextDocXml = applyTableReplacements(docXml, replacements);
  zip.file("word/document.xml", nextDocXml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/**
 * Generates FR.IA.06C (Lembar Jawaban Pertanyaan Tertulis Esai) DOCX directly from official
 * BNSP blanko (`src/templates/ak3u/FR.IA.06C.LEMBAR_JAWABAN_TERTULIS.docx`).
 */
export async function generateIa06cDocx(payload: Ia06cExportPayload): Promise<Buffer> {
  const { zip, docXml, tableSpans, hasEmbeddedSig, sigExt } = await loadDocxTemplateAndSig({
    fileName: "FR.IA.06C.LEMBAR_JAWABAN_TERTULIS.docx",
    templateBuffer: payload.templateBuffer,
    label: "FR.IA.06C",
    expectedTables: 5,
    allowFlexibleTableCount: Boolean(payload.templateBuffer),
    signatureBytes: payload.signaturePngBytes,
    signatureMime: payload.signatureMimeType,
  });

  const displaySchemeTitle = formatAk05SchemeTitle(payload.schemeTitle);
  const displayDate = formatAk05DateIndonesia(payload.assessmentDate);

  if (tableSpans.length < 5) {
    const tokenized = applyPlaceholderTokens(docXml, {
      SCHEME_TITLE: displaySchemeTitle,
      SCHEME_NUMBER: payload.schemeNumber,
      TUK_TYPE: payload.tukType,
      ASSESSOR_NAME: payload.assessorName,
      ASSESSOR_REG_NO: payload.assessorRegNo,
      ASSESSEE_NAME: payload.assesseeName,
      ASSESSMENT_DATE: displayDate,
    });
    zip.file("word/document.xml", tokenized);
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }

  // Table 1: Metadata (Judul, Nomor, TUK, Nama Asesor, Nama Asesi, Tanggal, Waktu)
  const t1Span = tableSpans[1]!;
  const updatedT1 = mutateTableRows(docXml.slice(t1Span.start, t1Span.end), (rows) =>
    rows.map((rowXml, rIdx) => {
      if (rIdx <= 3) {
        return fillCommonSchemeAndTukRow(rowXml, rIdx, {
          displaySchemeTitle,
          schemeNumber: payload.schemeNumber,
          tukType: payload.tukType,
          assessorName: payload.assessorName,
        });
      }
      if (rIdx === 4) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(payload.assesseeName)) : cXml,
        );
      }
      if (rIdx === 5) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2 ? replaceCellRuns(cXml, makeTextRun(displayDate)) : cXml,
        );
      }
      if (rIdx === 6) {
        return mutateRowCells(rowXml, (cXml, cIdx) =>
          cIdx === 2
            ? replaceCellRuns(cXml, makeTextRun(payload.durationText || "60 Menit"))
            : cXml,
        );
      }
      return rowXml;
    }),
  );

  // Table 2: Numbered ListParagraph answer slots (r2..r14 + cloned rows if >13)
  const t2Span = tableSpans[2]!;
  const updatedT2 = mutateTableRows(docXml.slice(t2Span.start, t2Span.end), (rows) => {
    const headerRows = rows.slice(0, 2);
    const bodyTemplates = rows.slice(2);
    const cloneBase = (bodyTemplates[bodyTemplates.length - 1] ?? "").replace(
      /\s+w14:(?:paraId|textId)="[^"]*"/g,
      "",
    );
    const totalRows = payload.answers.length > 0 ? payload.answers.length : bodyTemplates.length;
    const filledRows: string[] = [];

    for (let idx = 0; idx < totalRows; idx++) {
      let rowTpl = bodyTemplates[idx];
      if (!rowTpl) {
        let sdtSeed = 910000 + idx * 10;
        rowTpl = cloneBase.replace(/<w:id w:val="[^"]*"\/>/g, () => `<w:id w:val="${sdtSeed++}"/>`);
      }
      const item = payload.answers[idx];
      const withAnswer = mutateRowCells(rowTpl, (cXml, cIdx) =>
        cIdx === 0
          ? replaceCellRuns(cXml, makeTextRun(item?.answerText ?? ""))
          : cXml,
      );
      const flags: [boolean, boolean] =
        item?.achieved === true
          ? [true, false]
          : item?.achieved === false
            ? [false, true]
            : [false, false];
      filledRows.push(mutateSdtCheckboxes(withAnswer, flags));
    }

    return [...headerRows, ...filledRows];
  });

  // Table 3: Umpan balik untuk Asesi
  const t3Span = tableSpans[3]!;
  const updatedT3 = mutateTableRows(docXml.slice(t3Span.start, t3Span.end), (rows) =>
    rows.map((rowXml, rIdx) => {
      if (rIdx !== 0) return rowXml;
      const strikeTercapai = payload.overallAchieved === false;
      const strikeBelum = payload.overallAchieved === true;
      const runs = [
        makeTextRun("Aspek pengetahuan seluruh unit pada kelompok pekerjaan yang diujikan ("),
        makeTextRun("tercapai", { strike: strikeTercapai }),
        makeTextRun("/"),
        makeTextRun("belum tercapai", { strike: strikeBelum }),
        makeTextRun(")*"),
        ...(payload.feedbackDetail
          ? [makeTextRun(` Catatan unit/KUK: ${payload.feedbackDetail}`)]
          : []),
      ].join("");
      return mutateRowCells(rowXml, (cXml, cIdx) =>
        cIdx === 2 ? replaceCellRuns(cXml, runs) : cXml,
      );
    }),
  );

  // Table 4: Signature block (Asesi + Asesor)
  const t4Span = tableSpans[4]!;
  const updatedT4 = mutateTableRows(docXml.slice(t4Span.start, t4Span.end), (rows) =>
    fillAssesseeAndAssessorSigRows(rows, {
      startOffset: 0,
      assesseeName: payload.assesseeName,
      assessorName: payload.assessorName,
      assessorRegNo: payload.assessorRegNo,
      displayDate,
      hasEmbeddedSig,
      sigExt,
    }),
  );

  const nextDocXml = applyTableReplacements(docXml, [
    { span: t4Span, xml: updatedT4 },
    { span: t3Span, xml: updatedT3 },
    { span: t2Span, xml: updatedT2 },
    { span: t1Span, xml: updatedT1 },
  ]);

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
  fontBold: PDFFont;
  logoLeft?: PDFImage;
  logoRight?: PDFImage;
}) {
  const { page, pageNum, schemeTitle, fontRegular, fontBold, logoLeft, logoRight } = params;
  const xStart = AK05_LAYOUT.marginXPt;
  const xEnd = AK05_LAYOUT.rightEdgeXPt;

  if (logoLeft) {
    const dims = logoLeft.scaleToFit(86, 38);
    page.drawImage(logoLeft, { x: xStart, y: 785, width: dims.width, height: dims.height });
  }
  if (logoRight) {
    const dims = logoRight.scaleToFit(98, 42);
    page.drawImage(logoRight, { x: xEnd - dims.width, y: 783, width: dims.width, height: dims.height });
  }

  // Blue footer divider (#4472C4) matching FR.AK.05-2024 word/footer1.xml
  page.drawLine({
    start: { x: xStart, y: 50 },
    end: { x: xEnd, y: 50 },
    thickness: 1,
    color: rgb(...AK05_LAYOUT.colors.footerDividerRgb),
  });

  page.drawText(toWinAnsiSafe(formatAk05SchemeTitle(schemeTitle)), {
    x: xStart,
    y: 35,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.15, 0.15, 0.15),
  });

  const badgeSize = 15;
  const badgeX = xEnd - badgeSize;
  const badgeY = 30;
  page.drawRectangle({
    x: badgeX,
    y: badgeY,
    width: badgeSize,
    height: badgeSize,
    color: rgb(...AK05_LAYOUT.colors.pageBadgeRgb),
  });
  const pStr = String(pageNum);
  const pw = fontBold.widthOfTextAtSize(pStr, 8);
  page.drawText(pStr, {
    x: badgeX + (badgeSize - pw) / 2,
    y: badgeY + 4.5,
    size: 8,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const refLabel = AK05_LAYOUT.formCode;
  const rw = fontRegular.widthOfTextAtSize(refLabel, 7.5);
  page.drawText(refLabel, {
    x: badgeX - rw - 6,
    y: 35,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.15, 0.15, 0.15),
  });
}

/**
 * Renders a faithful A4 PDF mirroring all 5 tables, BNSP & LSP header logos,
 * borderless title row, #92D050 header/label shading, strikethrough TUK choices,
 * Page-1 Table 3 notes (for <=12 candidates), Page-2 Table 4 assessor block with
 * embedded signature, and #4472C4 / #A8D08D official footer.
 */
export async function generateAk05Pdf(payload: Ak05ExportPayload): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  let logoLeft: PDFImage | undefined;
  let logoRight: PDFImage | undefined;
  try {
    const zip = await JSZip.loadAsync(
      payload.templateBuffer ?? loadAk3uTemplateBuffer("FR.AK.05.LAPORAN_ASESMEN.docx"),
    );
    const img1 = await zip.file("word/media/image1.png")?.async("nodebuffer");
    const img2 = await zip.file("word/media/image2.png")?.async("nodebuffer");
    const isDefaultAk3u = !payload.schemeCode || payload.schemeCode.trim().toUpperCase() === "AK3U";
    if (img1) logoLeft = await pdfDoc.embedPng(img1);
    if (img2 && (Boolean(payload.templateBuffer) || isDefaultAk3u)) {
      logoRight = await pdfDoc.embedPng(img2);
    }
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

  const displaySchemeTitle = formatAk05SchemeTitle(payload.schemeTitle);
  const displayDate = formatAk05DateIndonesia(payload.assessmentDate);
  const greenFill: [number, number, number] = [...AK05_LAYOUT.colors.tableHeaderGreenRgb];

  const x0 = AK05_LAYOUT.marginXPt;
  const page1 = pdfDoc.addPage(AK05_LAYOUT.pageSizeA4Pt);
  drawBlankoHeaderFooter({
    page: page1,
    pageNum: 1,
    schemeTitle: displaySchemeTitle,
    fontRegular,
    fontBold,
    logoLeft,
    logoRight,
  });

  // Table 0: Borderless title row (FR.AK.05.   LAPORAN ASESMEN)
  let y = 766;
  page1.drawText("FR.AK.05.", { x: x0, y: y - 13, size: 11, font: fontBold });
  page1.drawText("LAPORAN ASESMEN", { x: x0 + 76, y: y - 13, size: 11, font: fontBold });
  y -= 20;

  // Table 1: 5-row Metadata block (widths: 128 | 50 | 14 | 294 = 486, exact blanko ratios)
  const [w1, w2, w3, w4] = AK05_LAYOUT.metadataColWidthsPt;
  const t1RowH = 18;
  drawCellBox(page1, x0, y, w1, t1RowH * 2);
  drawCellBox(page1, x0 + w1, y, w2, t1RowH);
  drawCellBox(page1, x0 + w1 + w2, y, w3, t1RowH);
  drawCellBox(page1, x0 + w1 + w2 + w3, y, w4, t1RowH);
  drawCellBox(page1, x0 + w1, y - t1RowH, w2, t1RowH);
  drawCellBox(page1, x0 + w1 + w2, y - t1RowH, w3, t1RowH);
  drawCellBox(page1, x0 + w1 + w2 + w3, y - t1RowH, w4, t1RowH);

  page1.drawText("Skema Sertifikasi", { x: x0 + 5, y: y - 13, size: 8.5, font: fontRegular });
  page1.drawText("(KKNI/Okupasi/Klaster)", { x: x0 + 5, y: y - 24, size: 8, font: fontRegular });
  page1.drawText("Judul", { x: x0 + w1 + 5, y: y - 12.5, size: 8.5, font: fontRegular });
  page1.drawText(":", { x: x0 + w1 + w2 + 5, y: y - 12.5, size: 8.5, font: fontRegular });
  page1.drawText(toWinAnsiSafe(displaySchemeTitle).slice(0, 52), {
    x: x0 + w1 + w2 + w3 + 5,
    y: y - 12.5,
    size: 8.5,
    font: fontBold,
  });
  page1.drawText("Nomor", { x: x0 + w1 + 5, y: y - t1RowH - 12.5, size: 8.5, font: fontRegular });
  page1.drawText(":", { x: x0 + w1 + w2 + 5, y: y - t1RowH - 12.5, size: 8.5, font: fontRegular });
  page1.drawText(toWinAnsiSafe(payload.schemeNumber).slice(0, 48), {
    x: x0 + w1 + w2 + w3 + 5,
    y: y - t1RowH - 12.5,
    size: 8.5,
    font: fontBold,
  });
  y -= t1RowH * 2;

  // TUK Row (exact blanko wording: Sewaktu/Tempat Kerja/Mandiri*, unused struck)
  drawCellBox(page1, x0, y, w1 + w2, t1RowH);
  drawCellBox(page1, x0 + w1 + w2, y, w3, t1RowH);
  drawCellBox(page1, x0 + w1 + w2 + w3, y, w4, t1RowH);
  page1.drawText("TUK", { x: x0 + 5, y: y - 12.5, size: 8.5, font: fontRegular });
  page1.drawText(":", { x: x0 + w1 + w2 + 5, y: y - 12.5, size: 8.5, font: fontRegular });
  const tukStartX = x0 + w1 + w2 + w3 + 5;
  const tukY = y - 12.5;
  const tukSegments: Array<{ label: string; struck: boolean }> = [
    { label: "Sewaktu", struck: payload.tukType !== "sewaktu" },
    { label: "/", struck: false },
    { label: "Tempat Kerja", struck: payload.tukType !== "tempat_kerja" },
    { label: "/", struck: false },
    { label: "Mandiri*", struck: payload.tukType !== "mandiri" },
  ];
  let cursorX = tukStartX;
  for (const seg of tukSegments) {
    page1.drawText(seg.label, { x: cursorX, y: tukY, size: 8.5, font: fontRegular });
    const sw = fontRegular.widthOfTextAtSize(seg.label, 8.5);
    if (seg.struck) {
      page1.drawLine({
        start: { x: cursorX, y: tukY + 3 },
        end: { x: cursorX + sw, y: tukY + 3 },
        thickness: 0.75,
        color: rgb(0.15, 0.15, 0.15),
      });
    }
    cursorX += sw;
  }
  y -= t1RowH;

  // Nama Asesor & Tanggal Rows
  for (const [label, val] of [
    ["Nama Asesor", payload.assessorName],
    ["Tanggal", displayDate],
  ] as const) {
    drawCellBox(page1, x0, y, w1 + w2, t1RowH);
    drawCellBox(page1, x0 + w1 + w2, y, w3, t1RowH);
    drawCellBox(page1, x0 + w1 + w2 + w3, y, w4, t1RowH);
    page1.drawText(label, { x: x0 + 5, y: y - 12.5, size: 8.5, font: fontRegular });
    page1.drawText(":", { x: x0 + w1 + w2 + 5, y: y - 12.5, size: 8.5, font: fontRegular });
    page1.drawText(toWinAnsiSafe(val).slice(0, 48), {
      x: x0 + w1 + w2 + w3 + 5,
      y: y - 12.5,
      size: 8.5,
      font: fontRegular,
    });
    y -= t1RowH;
  }

  // *Coret yang tidak perlu directly beneath Table 1
  page1.drawText(AK05_LAYOUT.footnoteAsterisk, {
    x: x0,
    y: y - 10.5,
    size: 8,
    font: fontItalic,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 17;

  // Table 2: Candidate Results Table with #92D050 green header
  const cw = AK05_LAYOUT.candidateColWidthsPt;
  const drawTable2Header = (p: PDFPage, yTop: number) => {
    drawCellBox(p, x0, yTop, cw[0], 30, greenFill);
    drawCellBox(p, x0 + cw[0], yTop, cw[1], 30, greenFill);
    drawCellBox(p, x0 + cw[0] + cw[1], yTop, cw[2] + cw[3], 15, greenFill);
    drawCellBox(p, x0 + cw[0] + cw[1], yTop - 15, cw[2], 15, greenFill);
    drawCellBox(p, x0 + cw[0] + cw[1] + cw[2], yTop - 15, cw[3], 15, greenFill);
    drawCellBox(p, x0 + cw[0] + cw[1] + cw[2] + cw[3], yTop, cw[4], 30, greenFill);

    const noW = fontBold.widthOfTextAtSize("No.", 8.5);
    p.drawText("No.", { x: x0 + (cw[0] - noW) / 2, y: yTop - 18, size: 8.5, font: fontBold });
    const nmW = fontBold.widthOfTextAtSize("Nama Asesi", 8.5);
    p.drawText("Nama Asesi", {
      x: x0 + cw[0] + (cw[1] - nmW) / 2,
      y: yTop - 18,
      size: 8.5,
      font: fontBold,
    });
    const recW = fontBold.widthOfTextAtSize("Rekomendasi", 8.5);
    p.drawText("Rekomendasi", {
      x: x0 + cw[0] + cw[1] + (cw[2] + cw[3] - recW) / 2,
      y: yTop - 10.5,
      size: 8.5,
      font: fontBold,
    });
    const kW = fontBold.widthOfTextAtSize("K", 8.5);
    p.drawText("K", {
      x: x0 + cw[0] + cw[1] + (cw[2] - kW) / 2,
      y: yTop - 25.5,
      size: 8.5,
      font: fontBold,
    });
    const bkW = fontBold.widthOfTextAtSize("BK", 8.5);
    p.drawText("BK", {
      x: x0 + cw[0] + cw[1] + cw[2] + (cw[3] - bkW) / 2,
      y: yTop - 25.5,
      size: 8.5,
      font: fontBold,
    });
    const ketW = fontBold.widthOfTextAtSize("Keterangan**", 8.5);
    p.drawText("Keterangan**", {
      x: x0 + cw[0] + cw[1] + cw[2] + cw[3] + (cw[4] - ketW) / 2,
      y: yTop - 18,
      size: 8.5,
      font: fontBold,
    });
    return yTop - 30;
  };

  const drawCandidateRow = (
    p: PDFPage,
    yTop: number,
    index: number,
    cand?: Ak05ExportPayload["rows"][number],
  ) => {
    const rowH = 18.5;
    drawCellBox(p, x0, yTop, cw[0], rowH);
    drawCellBox(p, x0 + cw[0], yTop, cw[1], rowH);
    drawCellBox(p, x0 + cw[0] + cw[1], yTop, cw[2], rowH);
    drawCellBox(p, x0 + cw[0] + cw[1] + cw[2], yTop, cw[3], rowH);
    drawCellBox(p, x0 + cw[0] + cw[1] + cw[2] + cw[3], yTop, cw[4], rowH);

    p.drawText(`${index + 1}.`, { x: x0 + 10, y: yTop - 12.5, size: 8.5, font: fontRegular });
    if (cand) {
      p.drawText(toWinAnsiSafe(cand.assesseeName).slice(0, 34), {
        x: x0 + cw[0] + 5,
        y: yTop - 12.5,
        size: 8.5,
        font: fontRegular,
      });
      drawCheckbox(p, x0 + cw[0] + cw[1] + cw[2] / 2, yTop - rowH / 2, cand.recommendation === "K");
      drawCheckbox(
        p,
        x0 + cw[0] + cw[1] + cw[2] + cw[3] / 2,
        yTop - rowH / 2,
        cand.recommendation === "BK",
      );
      if (cand.keterangan) {
        p.drawText(toWinAnsiSafe(cand.keterangan).slice(0, 36), {
          x: x0 + cw[0] + cw[1] + cw[2] + cw[3] + 5,
          y: yTop - 12.5,
          size: 8,
          font: fontRegular,
        });
      }
    }
    return yTop - rowH;
  };

  const drawTable3Block = (p: PDFPage, yTop: number) => {
    const noteRows: Array<[string, string, number]> = [
      [AK05_LAYOUT.noteRowLabels.positiveNegative, payload.notesPositiveNegative || "-", 48],
      [AK05_LAYOUT.noteRowLabels.rejection, payload.notesRejection || "-", 48],
      [AK05_LAYOUT.noteRowLabels.improvement, payload.notesImprovement || "-", 58],
    ];
    let curY = yTop;
    for (const [label, textVal, h] of noteRows) {
      drawCellBox(p, x0, curY, 162, h, greenFill);
      drawCellBox(p, x0 + 162, curY, 324, h);
      const labelLines = wrapLines(label, 28, 3);
      labelLines.forEach((line, lIdx) => {
        p.drawText(line, { x: x0 + 5, y: curY - 13 - lIdx * 11, size: 8.5, font: fontRegular });
      });
      const valLines = wrapLines(textVal, 58, 4);
      valLines.forEach((line, lIdx) => {
        p.drawText(line, { x: x0 + 167, y: curY - 13 - lIdx * 11, size: 8.5, font: fontRegular });
      });
      curY -= h;
    }
    return curY;
  };

  y = drawTable2Header(page1, y);
  const totalSlots = Math.max(AK05_LAYOUT.minCandidateSlots, payload.rows.length);
  const fitsSinglePageCandidates = totalSlots <= AK05_LAYOUT.minCandidateSlots;
  const page1Slots = fitsSinglePageCandidates
    ? totalSlots
    : Math.min(AK05_LAYOUT.maxPage1SlotsWhenOverflow, totalSlots);

  for (let i = 0; i < page1Slots; i++) {
    y = drawCandidateRow(page1, y, i, payload.rows[i]);
  }

  // Page 1 holds footnote + Table 3 directly below Table 2 when candidate count <= 12
  if (fitsSinglePageCandidates) {
    page1.drawText(AK05_LAYOUT.footnoteKeterangan, {
      x: x0,
      y: y - 10.5,
      size: 8,
      font: fontItalic,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 17;
    drawTable3Block(page1, y);
  }

  // Page 2: Overflow candidate rows (if >12) + Table 3 (if overflow) + Table 4 (Catatan + Asesor Signature Block)
  const page2 = pdfDoc.addPage(AK05_LAYOUT.pageSizeA4Pt);
  drawBlankoHeaderFooter({
    page: page2,
    pageNum: 2,
    schemeTitle: displaySchemeTitle,
    fontRegular,
    fontBold,
    logoLeft,
    logoRight,
  });

  let y2 = 766;
  if (!fitsSinglePageCandidates) {
    if (totalSlots > page1Slots) {
      y2 = drawTable2Header(page2, y2);
      for (let i = page1Slots; i < totalSlots; i++) {
        y2 = drawCandidateRow(page2, y2, i, payload.rows[i]);
      }
    }
    page2.drawText(AK05_LAYOUT.footnoteKeterangan, {
      x: x0,
      y: y2 - 10.5,
      size: 8,
      font: fontItalic,
      color: rgb(0.15, 0.15, 0.15),
    });
    y2 -= 17;
    y2 = drawTable3Block(page2, y2);
    y2 -= 14;
  }

  // Table 4: Catatan + Asesor Signature Block
  const [cLeft, cMid, cRight] = AK05_LAYOUT.assessorBlockColWidthsPt;
  const t4HeaderH = 20;
  const t4NameH = 20;
  const t4RegH = 20;
  const t4SigH = 74;
  const t4TotalH = t4HeaderH + t4NameH + t4RegH + t4SigH;

  drawCellBox(page2, x0, y2, cLeft, t4TotalH);
  page2.drawText("Catatan :", { x: x0 + 6, y: y2 - 13.5, size: 8.5, font: fontBold });

  // Right-hand header ("Asesor :") spanning cMid + cRight
  drawCellBox(page2, x0 + cLeft, y2, cMid + cRight, t4HeaderH);
  page2.drawText("Asesor :", { x: x0 + cLeft + 5, y: y2 - 13.5, size: 8.5, font: fontBold });
  y2 -= t4HeaderH;

  // Nama
  drawCellBox(page2, x0 + cLeft, y2, cMid, t4NameH);
  drawCellBox(page2, x0 + cLeft + cMid, y2, cRight, t4NameH);
  page2.drawText("Nama", { x: x0 + cLeft + 5, y: y2 - 13.5, size: 8.5, font: fontRegular });
  page2.drawText(toWinAnsiSafe(payload.assessorName).slice(0, 28), {
    x: x0 + cLeft + cMid + 5,
    y: y2 - 13.5,
    size: 8.5,
    font: fontRegular,
  });
  y2 -= t4NameH;

  // No. Reg
  drawCellBox(page2, x0 + cLeft, y2, cMid, t4RegH);
  drawCellBox(page2, x0 + cLeft + cMid, y2, cRight, t4RegH);
  page2.drawText("No. Reg", { x: x0 + cLeft + 5, y: y2 - 13.5, size: 8.5, font: fontRegular });
  page2.drawText(toWinAnsiSafe(payload.assessorRegNo).slice(0, 28), {
    x: x0 + cLeft + cMid + 5,
    y: y2 - 13.5,
    size: 8.5,
    font: fontRegular,
  });
  y2 -= t4RegH;

  // Tanda tangan & tanggal
  drawCellBox(page2, x0 + cLeft, y2, cMid, t4SigH);
  drawCellBox(page2, x0 + cLeft + cMid, y2, cRight, t4SigH);
  page2.drawText("Tanda tangan", { x: x0 + cLeft + 5, y: y2 - 30, size: 8.5, font: fontRegular });
  page2.drawText("& tanggal", { x: x0 + cLeft + 5, y: y2 - 41, size: 8.5, font: fontRegular });

  if (sigImage) {
    const dims = sigImage.scaleToFit(120, 44);
    page2.drawImage(sigImage, {
      x: x0 + cLeft + cMid + (cRight - dims.width) / 2,
      y: y2 - 50 + (44 - dims.height) / 2,
      width: dims.width,
      height: dims.height,
    });
  }
  const dateW = fontRegular.widthOfTextAtSize(toWinAnsiSafe(displayDate), 8.5);
  page2.drawText(toWinAnsiSafe(displayDate), {
    x: x0 + cLeft + cMid + (cRight - dateW) / 2,
    y: y2 - 64,
    size: 8.5,
    font: fontRegular,
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

/**
 * Generates combined written assessment & similarity report DOCX (Rule D8: DOCX only).
 */
export async function generateSimilarityReportDocx(params: {
  batchName: string;
  schemeName: string;
  thresholds: { exact: number; near: number; partial: number };
  thresholdsUncalibrated?: boolean;
  thresholdSourceLabel?: string;
  assessees: Array<{
    assesseeId: string;
    realName: string;
    plagiarismStatus: "Bersih" | "Waspada" | "Belum diperiksa";
    plagiarismReasoning: string;
    verdicts?: Array<{ questionNo: number; verdict: string; explanation: string }>;
    ringkasanKesalahan?: number[];
  }>;
  flaggedPairs: Array<{
    assesseeAName: string;
    assesseeBName: string;
    jaccardScore: number;
    tfidfCosine: number;
    verdict: string;
  }>;
}): Promise<Buffer> {
  const thresholdSummary =
    `Exact >= ${params.thresholds.exact.toFixed(2)} | Near >= ${params.thresholds.near.toFixed(2)} | Parsial >= ${params.thresholds.partial.toFixed(2)}` +
    (params.thresholdsUncalibrated ? " (Sementara / Belum Dikalibrasi — D19 / OQ-08)" : "") +
    (params.thresholdSourceLabel ? ` · Sumber: ${params.thresholdSourceLabel}` : "");

  const assesseeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          "No.",
          "Nama Asesi",
          "Ringkasan Kesalahan (No. Soal)",
          "Putusan Per Soal",
          "Status Kemiripan",
          "Catatan Analisis",
        ].map(
          (header) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: header, bold: true })],
                }),
              ],
            }),
        ),
      }),
      ...(params.assessees.length > 0
        ? params.assessees.map((a, idx) => {
            const errText =
              a.ringkasanKesalahan && a.ringkasanKesalahan.length > 0
                ? a.ringkasanKesalahan.join(", ")
                : a.verdicts && a.verdicts.length > 0
                  ? "Tidak ada"
                  : "Belum dinilai";
            const verdictText =
              a.verdicts && a.verdicts.length > 0
                ? a.verdicts.map((v) => `#${v.questionNo}: ${v.verdict}`).join("; ")
                : "Belum dinilai";
            return new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(String(idx + 1))] }),
                new TableCell({ children: [new Paragraph(a.realName)] }),
                new TableCell({ children: [new Paragraph(errText)] }),
                new TableCell({ children: [new Paragraph(verdictText)] }),
                new TableCell({ children: [new Paragraph(a.plagiarismStatus)] }),
                new TableCell({ children: [new Paragraph(a.plagiarismReasoning)] }),
              ],
            });
          })
        : [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("-")] }),
                new TableCell({ children: [new Paragraph("Belum ada asesi terdata")] }),
                new TableCell({ children: [new Paragraph("-")] }),
                new TableCell({ children: [new Paragraph("-")] }),
                new TableCell({ children: [new Paragraph("-")] }),
                new TableCell({ children: [new Paragraph("-")] }),
              ],
            }),
          ]),
    ],
  });

  const pairTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: ["Asesi A", "Asesi B", "Jaccard", "Cosine TF-IDF", "Status"].map(
          (header) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: header, bold: true })],
                }),
              ],
            }),
        ),
      }),
      ...(params.flaggedPairs.length > 0
        ? params.flaggedPairs.map(
            (p) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(p.assesseeAName)] }),
                  new TableCell({ children: [new Paragraph(p.assesseeBName)] }),
                  new TableCell({ children: [new Paragraph(p.jaccardScore.toFixed(4))] }),
                  new TableCell({ children: [new Paragraph(p.tfidfCosine.toFixed(4))] }),
                  new TableCell({ children: [new Paragraph(p.verdict)] }),
                ],
              }),
          )
        : [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("-")] }),
                new TableCell({
                  children: [
                    new Paragraph(
                      "Tidak ada pasangan melebihi ambang batas deteksi.",
                    ),
                  ],
                }),
                new TableCell({ children: [new Paragraph("-")] }),
                new TableCell({ children: [new Paragraph("-")] }),
                new TableCell({ children: [new Paragraph("Bersih")] }),
              ],
            }),
          ]),
    ],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Laporan Gabungan Penilaian Tertulis & Analisis Kemiripan",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Batch: ", bold: true }),
              new TextRun(params.batchName),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Skema Sertifikasi: ", bold: true }),
              new TextRun(params.schemeName),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Ambang Batas Deteksi: ", bold: true }),
              new TextRun(thresholdSummary),
            ],
          }),
          new Paragraph({
            text: "Catatan: Skor kemiripan hanyalah indikator peninjauan bagi asesor (flag only — bukan vonis otomatis).",
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: "1. Ringkasan Penilaian Per Asesi",
            heading: HeadingLevel.HEADING_2,
          }),
          assesseeTable,
          new Paragraph({ text: "" }),
          new Paragraph({
            text: "2. Pasangan Kemiripan Terdeteksi",
            heading: HeadingLevel.HEADING_2,
          }),
          pairTable,
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return Buffer.from(buf);
}
