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

export async function extractTextFromDocx(buffer: Buffer): Promise<{
  text: string;
  embeddedImageCount: number;
}> {
  if (isOleEncryptedBuffer(buffer)) {
    throw new Error("KEY_ENCRYPTED: Dokumen OOXML terenkripsi memerlukan kata sandi runtime.");
  }

  const result = await mammoth.extractRawText({ buffer });
  // Detect embedded images in word/media inside OOXML zip container (D12: never silently drop)
  let embeddedImageCount = 0;
  try {
    const zip = await JSZip.loadAsync(buffer);
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
  const zip = await JSZip.loadAsync(buffer);
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
    .replace(/\\t/g, " ");
}

/**
 * Lightweight pure-Node PDF text-layer extractor for standard FlateDecode / uncompressed
 * text operators (Tj / TJ). Returns "" for scanned image-only PDFs without crashing.
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

  const haystack = streams.length > 0 ? streams.join("\n") : latin;
  const parts: string[] = [];
  const tjRe = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
  for (const m of haystack.matchAll(tjRe)) {
    const val = unescapePdfLiteral(m[1] ?? "").trim();
    if (val) parts.push(val);
  }

  const tjArrayRe = /\[([^\]]+)\]\s*TJ/g;
  for (const m of haystack.matchAll(tjArrayRe)) {
    const inner = m[1] ?? "";
    const segs: string[] = [];
    for (const sm of inner.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g)) {
      segs.push(unescapePdfLiteral(sm[1] ?? ""));
    }
    const joined = segs.join("").trim();
    if (joined) parts.push(joined);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
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
