import mammoth from "mammoth";
import JSZip from "jszip";
import ExcelJS from "exceljs";

const OLE_MAGIC_BYTES = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

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
