import mammoth from "mammoth";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import zlib from "node:zlib";
import { sanitizeExtractedText } from "@/lib/text/sanitize-extracted-text";

export { sanitizeExtractedText };

const OLE_MAGIC_BYTES = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const MAX_PDF_EXTRACT_BYTES = 15 * 1024 * 1024;

/**
 * Checks whether a buffer starts with the OLE Compound File Binary signature
 * (indicates encrypted OOXML/06B file requiring runtime password via worker msoffcrypto-tool).
 */
export function isOleEncryptedBuffer(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  return OLE_MAGIC_BYTES.every((byte, idx) => buffer[idx] === byte);
}

export interface SafeZipEntry {
  entryPath: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  modifiedTimeIso: string | null;
}

const MAX_ZIP_ARCHIVE_BYTES = 15 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 120;
const MAX_ZIP_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;
const ZIP_EXTRACTABLE_EXT_RE = /\.(docx|doc|pptx|ppt|xlsx|xls|pdf|txt|csv|md|jpe?g|png|webp)$/i;
export const EXTRACTABLE_TEXT_EXT_RE = /\.(docx|pptx|xlsx|pdf|txt|csv|md)$/i;

export function inferMimeTypeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".csv")) return "text/csv";
  return "application/octet-stream";
}

/**
 * Rebuilds a malformed OOXML zip whose CRC-32 header bytes were zeroed by non-Word tools
 * (adapted safely from MUK desktop helper `perbaiki_docx`), keeping operations strictly in memory.
 */
async function loadZipLenient(buffer: Buffer): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(buffer, { checkCRC32: true });
  } catch {
    return await JSZip.loadAsync(buffer, { checkCRC32: false });
  }
}

export async function repairBrokenZipCrcBuffer(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
  const rebuilt = new JSZip();
  const names = Object.keys(zip.files);
  for (const name of names) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    const content = await entry.async("nodebuffer");
    rebuilt.file(name, content, { date: entry.date });
  }
  return rebuilt.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/**
 * Detects standard PKZIP general-purpose bit-0 encryption flag on the first local file header.
 */
export function isEncryptedZipBuffer(buffer: Buffer): boolean {
  if (buffer.length < 10) return false;
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    const generalPurposeFlags = buffer.readUInt16LE(6);
    return (generalPurposeFlags & 0x0001) !== 0;
  }
  return false;
}

/**
 * Safely unpacks uploaded `.zip` archives in memory with path-traversal sanitization,
 * entry-count limits, and uncompressed bomb guards while preserving entry `date` (`mtime`).
 */
export async function unpackSafeZipEntries(
  buffer: Buffer,
  options?: {
    maxArchiveBytes?: number;
    maxEntries?: number;
    maxUncompressedBytes?: number;
  },
): Promise<SafeZipEntry[]> {
  const maxArchive = options?.maxArchiveBytes ?? MAX_ZIP_ARCHIVE_BYTES;
  const maxEntries = options?.maxEntries ?? MAX_ZIP_ENTRIES;
  const maxUncompressed = options?.maxUncompressedBytes ?? MAX_ZIP_UNCOMPRESSED_BYTES;

  if (buffer.length === 0 || buffer.length > maxArchive) {
    throw new Error(`ZIP_TOO_LARGE: Ukuran arsip melebihi batas ${(maxArchive / (1024 * 1024)).toFixed(0)} MB.`);
  }

  if (isEncryptedZipBuffer(buffer)) {
    throw new Error(
      "ZIP_ENCRYPTED: Arsip ZIP dilindungi kata sandi / terenkripsi dan tidak dapat diekstrak otomatis.",
    );
  }

  let zip: JSZip;
  try {
    zip = await loadZipLenient(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/encrypt/i.test(msg)) {
      throw new Error(
        "ZIP_ENCRYPTED: Arsip ZIP dilindungi kata sandi / terenkripsi dan tidak dapat diekstrak otomatis.",
      );
    }
    throw new Error(
      "ZIP_UNSUPPORTED_ARCHIVE: Format arsip tidak dapat dibuka (kemungkinan multi-volume, rusak, atau bukan ZIP standar).",
    );
  }
  const results: SafeZipEntry[] = [];
  let totalBytes = 0;

  for (const rawName of Object.keys(zip.files)) {
    const entry = zip.files[rawName];
    if (!entry || entry.dir) continue;

    const normalizedPath = rawName.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalizedPath || normalizedPath.includes("..") || normalizedPath.includes("\0")) {
      continue;
    }

    const baseName = normalizedPath.split("/").pop() ?? "";
    if (
      !baseName ||
      normalizedPath.startsWith("__MACOSX/") ||
      baseName.startsWith("._") ||
      baseName === ".DS_Store" ||
      baseName.startsWith("~$") ||
      !ZIP_EXTRACTABLE_EXT_RE.test(baseName)
    ) {
      continue;
    }

    if (results.length >= maxEntries) {
      break;
    }

    const entryBuf = await entry.async("nodebuffer");
    totalBytes += entryBuf.length;
    if (totalBytes > maxUncompressed) {
      throw new Error("ZIP_UNCOMPRESSED_LIMIT: Total isi arsip melebihi batas keamanan ekstraksi.");
    }
    if (entryBuf.length === 0) continue;

    results.push({
      entryPath: normalizedPath,
      fileName: baseName,
      mimeType: inferMimeTypeFromFileName(baseName),
      buffer: entryBuf,
      modifiedTimeIso:
        entry.date instanceof Date && !Number.isNaN(entry.date.getTime())
          ? entry.date.toISOString()
          : null,
    });
  }

  return results;
}

export async function extractTextFromDocx(buffer: Buffer): Promise<{
  text: string;
  embeddedImageCount: number;
}> {
  if (isOleEncryptedBuffer(buffer)) {
    throw new Error("KEY_ENCRYPTED: Dokumen OOXML terenkripsi memerlukan kata sandi runtime.");
  }

  let effectiveBuffer = buffer;
  let result: { value: string };
  try {
    result = await mammoth.extractRawText({ buffer: effectiveBuffer });
  } catch {
    effectiveBuffer = await repairBrokenZipCrcBuffer(buffer);
    result = await mammoth.extractRawText({ buffer: effectiveBuffer });
  }

  // Detect embedded images in word/media inside OOXML zip container (D12: never silently drop)
  let embeddedImageCount = 0;
  try {
    const zip = await loadZipLenient(effectiveBuffer);
    embeddedImageCount = Object.keys(zip.files).filter((name) =>
      name.startsWith("word/media/"),
    ).length;
  } catch {
    embeddedImageCount = 0;
  }

  return {
    text: result.value.trim(),
    embeddedImageCount,
  };
}

export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  const zip = await loadZipLenient(buffer);
  const slideKeys = Object.keys(zip.files)
    .filter((k) => /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(k))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const chunks: string[] = [];
  for (const key of slideKeys) {
    const file = zip.file(key);
    if (!file) continue;
    const xml = await file.async("text");
    const texts = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => m[1] ?? "");
    if (texts.length > 0) {
      chunks.push(`[${key}] ${texts.join(" ")}`);
    }
  }

  return chunks.join("\n").trim();
}

const PLACEHOLDER_CELL_RE = /^[….\-_=|:•]+$/;

export function formatExcelCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : "";
  }
  if (typeof value === "object") {
    const obj = value as {
      richText?: Array<{ text?: unknown }>;
      result?: unknown;
      text?: unknown;
    };
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();
    }
    if ("result" in obj && obj.result !== undefined && obj.result !== null) {
      return formatExcelCellValue(obj.result);
    }
    if (typeof obj.text === "string") {
      return obj.text.trim();
    }
  }
  return "";
}

export async function extractTextFromXlsx(buffer: Buffer): Promise<string> {
  if (isOleEncryptedBuffer(buffer)) {
    throw new Error("KEY_ENCRYPTED: File Excel terenkripsi memerlukan kata sandi runtime.");
  }

  const workbook = new ExcelJS.Workbook();
  const arrayBuf = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuf);
  const lines: string[] = [];

  workbook.eachSheet((sheet) => {
    lines.push(`--- Sheet: ${sheet.name} ---`);
    let prevLine = "";
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[])
        .slice(1)
        .map(formatExcelCellValue)
        .filter((cell) => cell.length > 0 && !PLACEHOLDER_CELL_RE.test(cell));

      const dedup: string[] = [];
      for (const cell of cells) {
        if (dedup[dedup.length - 1] !== cell) {
          dedup.push(cell);
        }
      }
      if (dedup.length === 0) return;

      const line = dedup.join(" | ");
      if (line !== prevLine) {
        lines.push(line);
        prevLine = line;
      }
    });
  });

  return lines.join("\n").trim();
}

function unescapePdfLiteral(raw: string): string {
  return raw
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) =>
      String.fromCharCode(Number.parseInt(oct, 8)),
    );
}

function parsePdfLiteralAt(input: string, openParenIdx: number): { value: string; nextIdx: number } {
  let i = openParenIdx + 1;
  let depth = 1;
  let raw = "";
  while (i < input.length && depth > 0) {
    const ch = input[i];
    if (ch === "\\") {
      const next = input[i + 1] ?? "";
      raw += `\\${next}`;
      i += 2;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      raw += ch;
      i += 1;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        i += 1;
        break;
      }
      raw += ch;
      i += 1;
      continue;
    }
    raw += ch;
    i += 1;
  }
  return { value: unescapePdfLiteral(raw), nextIdx: i };
}

// Relative glyph width factors (fraction of font size) calibrated for proportional sans-serif PDF text
const PDF_CHAR_WIDTH_FACTORS: Readonly<Record<string, number>> = {
  " ": 0.23, "!": 0.30, '"': 0.38, "#": 0.50, "$": 0.50, "%": 0.72, "&": 0.68, "'": 0.22,
  "(": 0.30, ")": 0.30, "*": 0.48, "+": 0.50, ",": 0.25, "-": 0.30, ".": 0.25, "/": 0.38,
  "0": 0.50, "1": 0.50, "2": 0.50, "3": 0.50, "4": 0.50, "5": 0.50, "6": 0.50, "7": 0.50,
  "8": 0.50, "9": 0.50, ":": 0.26, ";": 0.26, "<": 0.50, "=": 0.50, ">": 0.50, "?": 0.46,
  "@": 0.88,
  A: 0.58, B: 0.54, C: 0.53, D: 0.61, E: 0.49, F: 0.46, G: 0.63, H: 0.62, I: 0.25, J: 0.32,
  K: 0.52, L: 0.42, M: 0.85, N: 0.64, O: 0.66, P: 0.52, Q: 0.67, R: 0.54, S: 0.46, T: 0.49,
  U: 0.64, V: 0.57, W: 0.88, X: 0.52, Y: 0.49, Z: 0.47,
  a: 0.48, b: 0.52, c: 0.42, d: 0.52, e: 0.49, f: 0.30, g: 0.47, h: 0.52, i: 0.23, j: 0.24,
  k: 0.45, l: 0.23, m: 0.79, n: 0.52, o: 0.52, p: 0.52, q: 0.52, r: 0.35, s: 0.39, t: 0.33,
  u: 0.52, v: 0.45, w: 0.71, x: 0.43, y: 0.45, z: 0.39,
};

function estimatePdfTextWidth(text: string, fontSize: number): number {
  let sum = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? " ";
    sum += PDF_CHAR_WIDTH_FACTORS[ch] ?? 0.46;
  }
  return sum * fontSize;
}

function isLikelyTextContentStream(decoded: string): boolean {
  if (decoded.length < 4) return false;
  // Embedded TrueType/binary streams can contain accidental "Tj"/"TJ" byte sequences; reject if null bytes appear.
  const sampleLen = Math.min(decoded.length, 512);
  let nulls = 0;
  for (let i = 0; i < sampleLen; i += 1) {
    if (decoded.charCodeAt(i) === 0) nulls += 1;
  }
  if (nulls > 2) return false;
  return /\b(?:Tj|TJ)\b/.test(decoded);
}

interface PositionedPdfSpan {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  text: string;
  seq: number;
}

function extractStreamTextWithLayout(stream: string): string[] {
  const spans: PositionedPdfSpan[] = [];
  let hasExplicitCoords = false;
  let curX = 0;
  let curY = 0;
  let lineX = 0;
  let lineY = 0;
  let fontSize = 11;
  let scaleY = 1;
  let leading = 14;
  let seq = 0;
  let numericWindow: number[] = [];

  const pushSpan = (rawText: string, extraAdvancePts = 0) => {
    const cleaned = rawText.replace(/\r?\n/g, " ");
    const effSize = Math.max(4, fontSize * scaleY);
    if (!cleaned.trim()) {
      curX += estimatePdfTextWidth(cleaned, effSize) + extraAdvancePts;
      return;
    }
    const width = Math.max(0, estimatePdfTextWidth(cleaned, effSize) + extraAdvancePts);
    spans.push({ x: curX, y: curY, width, fontSize: effSize, text: cleaned, seq });
    seq += 1;
    curX += width;
  };

  let i = 0;
  const len = stream.length;
  while (i < len) {
    const ch = stream[i] ?? "";

    // Skip PDF comments
    if (ch === "%") {
      const nl = stream.indexOf("\n", i);
      if (nl === -1) break;
      i = nl + 1;
      continue;
    }

    // String literal (...) possibly followed by Tj / ' / "
    if (ch === "(") {
      const { value, nextIdx } = parsePdfLiteralAt(stream, i);
      let j = nextIdx;
      while (j < len && /\s/.test(stream[j] ?? "")) j += 1;
      const op2 = stream.slice(j, j + 2);
      const op1 = stream[j] ?? "";
      if (op2 === "Tj" || op1 === "'" || op1 === '"') {
        if (op1 === "'" || op1 === '"') {
          lineY -= leading;
          curX = lineX;
          curY = lineY;
          hasExplicitCoords = true;
        }
        pushSpan(value);
        i = j + (op2 === "Tj" ? 2 : 1);
        numericWindow = [];
        continue;
      }
      i = nextIdx;
      continue;
    }

    // TJ array [...] TJ
    if (ch === "[") {
      let j = i + 1;
      let segment = "";
      let kernAdvancePts = 0;
      const effSize = Math.max(4, fontSize * scaleY);
      while (j < len && stream[j] !== "]") {
        const innerCh = stream[j] ?? "";
        if (innerCh === "(") {
          const { value, nextIdx } = parsePdfLiteralAt(stream, j);
          segment += value;
          j = nextIdx;
          continue;
        }
        if (innerCh === "-" || (innerCh >= "0" && innerCh <= "9") || innerCh === ".") {
          const numMatch = stream.slice(j).match(/^-?\d+(?:\.\d+)?/);
          if (numMatch?.[0]) {
            const adj = Number(numMatch[0]);
            if (adj < -140 && segment && !segment.endsWith(" ")) {
              segment += " ";
            } else {
              kernAdvancePts -= (adj / 1000) * effSize;
            }
            j += numMatch[0].length;
            continue;
          }
        }
        j += 1;
      }
      if (stream[j] === "]") {
        let k = j + 1;
        while (k < len && /\s/.test(stream[k] ?? "")) k += 1;
        if (stream.slice(k, k + 2) === "TJ") {
          pushSpan(segment, kernAdvancePts);
          i = k + 2;
          numericWindow = [];
          continue;
        }
      }
      i += 1;
      continue;
    }

    // Numbers (operands for Tf, TL, Td, TD, Tm)
    if (ch === "-" || ch === "+" || ch === "." || (ch >= "0" && ch <= "9")) {
      const prevCh = i > 0 ? stream[i - 1] ?? "" : " ";
      if (/\s|\[|\]/.test(prevCh) || i === 0) {
        const numMatch = stream.slice(i).match(/^[+-]?\d+(?:\.\d+)?/);
        if (numMatch?.[0]) {
          numericWindow.push(Number(numMatch[0]));
          if (numericWindow.length > 6) numericWindow.shift();
          i += numMatch[0].length;
          continue;
        }
      }
    }

    // Text positioning / font / line operators
    if (/[A-Za-z*]/.test(ch)) {
      const tokMatch = stream.slice(i).match(/^[A-Za-z*]+/);
      const tok = tokMatch?.[0] ?? "";
      if (tok === "BT") {
        curX = 0;
        curY = 0;
        lineX = 0;
        lineY = 0;
        scaleY = 1;
        numericWindow = [];
      } else if (tok === "ET") {
        numericWindow = [];
      } else if (tok === "Tf" && numericWindow.length >= 1) {
        const sz = Math.abs(numericWindow[numericWindow.length - 1] ?? 11);
        if (sz > 1 && sz < 200) fontSize = sz;
        numericWindow = [];
      } else if (tok === "TL" && numericWindow.length >= 1) {
        leading = numericWindow[numericWindow.length - 1] ?? 14;
        numericWindow = [];
      } else if (tok === "T*") {
        lineY -= leading;
        curX = lineX;
        curY = lineY;
        hasExplicitCoords = true;
        numericWindow = [];
      } else if ((tok === "Td" || tok === "TD") && numericWindow.length >= 2) {
        const dx = numericWindow[numericWindow.length - 2] ?? 0;
        const dy = numericWindow[numericWindow.length - 1] ?? 0;
        lineX += dx;
        lineY += dy;
        curX = lineX;
        curY = lineY;
        if (tok === "TD") leading = -dy;
        hasExplicitCoords = true;
        numericWindow = [];
      } else if (tok === "Tm" && numericWindow.length >= 6) {
        const dScale = Math.abs(numericWindow[3] ?? 1);
        const tx = numericWindow[4] ?? 0;
        const ty = numericWindow[5] ?? 0;
        scaleY = dScale > 0.1 && dScale < 20 ? dScale : 1;
        lineX = tx;
        lineY = ty;
        curX = tx;
        curY = ty;
        hasExplicitCoords = true;
        numericWindow = [];
      } else {
        numericWindow = [];
      }
      i += tok.length;
      continue;
    }

    i += 1;
  }

  if (spans.length === 0) return [];
  if (!hasExplicitCoords) {
    return [spans.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim()].filter(Boolean);
  }

  // Group spans by visual baseline y (descending top-to-bottom), tolerating small cell vertical offsets (e.g. 2pt)
  const sortedByY = [...spans].sort((a, b) => b.y - a.y || a.x - b.x || a.seq - b.seq);
  const rows: Array<{ y: number; fontSize: number; items: PositionedPdfSpan[] }> = [];
  for (const sp of sortedByY) {
    const existing = rows.find((r) => {
      const tol = Math.max(3.5, Math.max(r.fontSize, sp.fontSize) * 0.35);
      return Math.abs(r.y - sp.y) <= tol;
    });
    if (existing) {
      existing.items.push(sp);
    } else {
      rows.push({ y: sp.y, fontSize: sp.fontSize, items: [sp] });
    }
  }
  rows.sort((a, b) => b.y - a.y);

  const lines: string[] = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x || a.seq - b.seq);
    let line = "";
    let prevEndX: number | null = null;
    let prevFs = row.fontSize;
    for (const item of row.items) {
      const piece = item.text;
      if (prevEndX !== null && line.length > 0) {
        const gap = item.x - prevEndX;
        const spaceThreshold = Math.min(prevFs, item.fontSize) * 0.14;
        const alreadySpaced = line.endsWith(" ") || piece.startsWith(" ");
        if (!alreadySpaced && gap > spaceThreshold) {
          line += " ";
        }
      }
      line += piece;
      prevEndX = item.x + item.width;
      prevFs = item.fontSize;
    }
    const cleaned = line.replace(/[ \t]+/g, " ").trim();
    if (cleaned) lines.push(cleaned);
  }

  return lines;
}

/**
 * Lightweight pure-Node PDF text-layer extractor for standard FlateDecode / uncompressed
 * text operators (Tj / TJ / Td / Tm). Preserves visual reading order and line breaks cleanly
 * across multi-BT blocks and returns "" for scanned image-only PDFs without crashing.
 */
export function extractTextFromPdfBasic(buffer: Buffer): string {
  if (buffer.length === 0 || buffer.length > MAX_PDF_EXTRACT_BYTES) return "";
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return "";

  const latin = buffer.toString("latin1");
  const streams: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const m of latin.matchAll(streamRe)) {
    const body = m[1];
    if (!body) continue;
    const rawBytes = Buffer.from(body, "latin1");
    let decoded: string | null = null;
    try {
      decoded = zlib.inflateSync(rawBytes).toString("latin1");
    } catch {
      decoded = rawBytes.toString("latin1");
    }
    if (decoded && isLikelyTextContentStream(decoded)) {
      streams.push(decoded);
    }
  }

  const targetStreams = streams.length > 0 ? streams : [latin];
  const allLines: string[] = [];
  for (const st of targetStreams) {
    allLines.push(...extractStreamTextWithLayout(st));
  }

  return sanitizeExtractedText(allLines.join("\n")).trim();
}

export async function extractTextFromBuffer(params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<{ text: string; extractionMethod: string }> {
  const nameLower = params.fileName.toLowerCase();
  const mimeLower = (params.mimeType ?? "").toLowerCase();

  if (mimeLower.includes("presentationml") || nameLower.endsWith(".pptx")) {
    return {
      text: sanitizeExtractedText(await extractTextFromPptx(params.buffer)).trim(),
      extractionMethod: "ooxml_pptx",
    };
  }
  if (mimeLower.includes("spreadsheetml") || nameLower.endsWith(".xlsx")) {
    return {
      text: sanitizeExtractedText(await extractTextFromXlsx(params.buffer)).trim(),
      extractionMethod: "ooxml_xlsx",
    };
  }
  if (mimeLower.includes("wordprocessingml") || nameLower.endsWith(".docx")) {
    const res = await extractTextFromDocx(params.buffer);
    const rawText =
      res.embeddedImageCount > 0 && !res.text
        ? `[Dokumen berisi ${res.embeddedImageCount} gambar tersemat — perlu tinjauan manual]`
        : res.text;
    return {
      text: sanitizeExtractedText(rawText).trim(),
      extractionMethod: "ooxml_docx",
    };
  }
  if (mimeLower === "application/pdf" || nameLower.endsWith(".pdf")) {
    return {
      text: sanitizeExtractedText(extractTextFromPdfBasic(params.buffer)).trim(),
      extractionMethod: "pdf_text_layer",
    };
  }
  if (
    mimeLower.startsWith("text/") ||
    nameLower.endsWith(".txt") ||
    nameLower.endsWith(".csv") ||
    nameLower.endsWith(".md")
  ) {
    return {
      text: sanitizeExtractedText(params.buffer.toString("utf8")).trim(),
      extractionMethod: "raw_text",
    };
  }

  return { text: "", extractionMethod: "unsupported" };
}
