import mammoth from "mammoth";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import zlib from "node:zlib";

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
    sheet.eachRow((row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => String(v ?? "").trim());
      if (vals.some(Boolean)) {
        lines.push(vals.join(" | "));
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

function extractStreamTextWithLayout(stream: string): string[] {
  const lines: string[] = [];
  let currentLine = "";
  let lastY: number | null = null;
  let numericWindow: number[] = [];

  const flushLine = () => {
    const cleaned = currentLine.replace(/[ \t]+/g, " ").trim();
    if (cleaned) lines.push(cleaned);
    currentLine = "";
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
        if (op1 === "'") flushLine();
        if (value) {
          if (currentLine && !currentLine.endsWith(" ") && !value.startsWith(" ")) {
            currentLine += value;
          } else {
            currentLine += value;
          }
        }
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
          currentLine += segment;
          i = k + 2;
          numericWindow = [];
          continue;
        }
      }
      i += 1;
      continue;
    }

    // Numbers (operands for Td, TD, Tm)
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

    // Text positioning / line operators
    if (/[A-Za-z*]/.test(ch)) {
      const tokMatch = stream.slice(i).match(/^[A-Za-z*]+/);
      const tok = tokMatch?.[0] ?? "";
      if (tok === "BT") {
        lastY = null;
        numericWindow = [];
      } else if (tok === "ET") {
        flushLine();
        lastY = null;
        numericWindow = [];
      } else if (tok === "T*") {
        flushLine();
        numericWindow = [];
      } else if ((tok === "Td" || tok === "TD") && numericWindow.length >= 2) {
        const dx = numericWindow[numericWindow.length - 2] ?? 0;
        const dy = numericWindow[numericWindow.length - 1] ?? 0;
        if (Math.abs(dy) > 2) {
          flushLine();
        } else if (Math.abs(dx) > 4 && currentLine && !currentLine.endsWith(" ")) {
          currentLine += " ";
        }
        lastY = (lastY ?? 0) + dy;
        numericWindow = [];
      } else if (tok === "Tm" && numericWindow.length >= 6) {
        const ty = numericWindow[5] ?? 0;
        if (lastY !== null && Math.abs(ty - lastY) > 2) {
          flushLine();
        } else if (currentLine && !currentLine.endsWith(" ")) {
          currentLine += " ";
        }
        lastY = ty;
        numericWindow = [];
      } else {
        numericWindow = [];
      }
      i += tok.length;
      continue;
    }

    i += 1;
  }

  flushLine();
  return lines;
}

/**
 * Lightweight pure-Node PDF text-layer extractor for standard FlateDecode / uncompressed
 * text operators (Tj / TJ / Td / Tm). Preserves reading order and line breaks cleanly
 * and returns "" for scanned image-only PDFs without crashing.
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
    if (decoded && (decoded.includes("Tj") || decoded.includes("TJ"))) {
      streams.push(decoded);
    }
  }

  const targetStreams = streams.length > 0 ? streams : [latin];
  const allLines: string[] = [];
  for (const st of targetStreams) {
    allLines.push(...extractStreamTextWithLayout(st));
  }

  return allLines.join("\n").trim();
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
      text: await extractTextFromPptx(params.buffer),
      extractionMethod: "ooxml_pptx",
    };
  }
  if (mimeLower.includes("spreadsheetml") || nameLower.endsWith(".xlsx")) {
    return {
      text: await extractTextFromXlsx(params.buffer),
      extractionMethod: "ooxml_xlsx",
    };
  }
  if (mimeLower.includes("wordprocessingml") || nameLower.endsWith(".docx")) {
    const res = await extractTextFromDocx(params.buffer);
    const text =
      res.embeddedImageCount > 0 && !res.text
        ? `[Dokumen berisi ${res.embeddedImageCount} gambar tersemat — perlu tinjauan manual]`
        : res.text;
    return { text, extractionMethod: "ooxml_docx" };
  }
  if (mimeLower === "application/pdf" || nameLower.endsWith(".pdf")) {
    return {
      text: extractTextFromPdfBasic(params.buffer),
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
      text: params.buffer.toString("utf8").trim(),
      extractionMethod: "raw_text",
    };
  }

  return { text: "", extractionMethod: "unsupported" };
}
