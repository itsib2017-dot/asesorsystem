import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import {
  updateDriveFileExtraction,
  type DriveFileRecord,
} from "@/repositories/batches.repository";
import { extractTextFromBuffer } from "@/services/extract";

const DRIVE_FILE_ID_REGEX = /^[a-zA-Z0-9_-]{5,128}$/;
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_DRIVE_DOWNLOAD_DOMAINS = [
  "drive.google.com",
  "drive.usercontent.google.com",
  "googleusercontent.com",
  "www.googleapis.com",
];

const EXTRACTABLE_EXT_RE = /\.(docx|pptx|xlsx|pdf|txt|csv|md)$/i;

export interface DriveExtractionOutcome {
  text: string | null;
  extractionMethod?: string;
  error?: string;
}

async function fetchWithValidatedRedirects(
  initialUrl: string,
  maxBytes: number,
  maxRedirects = 3,
): Promise<Buffer> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = validateSafeExternalUrl(currentUrl, ALLOWED_DRIVE_DOWNLOAD_DOMAINS);
    if (!check.safe) {
      throw new Error(`SSRF_BLOCKED: ${check.reason}`);
    }

    const res = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": "AsesorKompetensi/1.4 (+https://assessor-zeta.vercel.app)",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error(`DRIVE_REDIRECT_ERROR: HTTP ${res.status} tanpa Location header.`);
      }
      const resolved = new URL(location, currentUrl).toString();
      currentUrl = resolved;
      continue;
    }

    if (!res.ok) {
      throw new Error(`DRIVE_DOWNLOAD_ERROR: HTTP ${res.status}`);
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.includes("text/html")) {
      throw new Error(
        "DRIVE_HTML_INTERSTITIAL: Berkas Drive tidak dapat diunduh langsung (memerlukan izin atau konfirmasi ukuran).",
      );
    }

    const contentLengthHeader = res.headers.get("content-length");
    if (contentLengthHeader) {
      const declaredSize = Number(contentLengthHeader);
      if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
        throw new Error(`FILE_TOO_LARGE: Ukuran berkas (${declaredSize} byte) melebihi batas.`);
      }
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    if (buf.length > maxBytes) {
      throw new Error(`FILE_TOO_LARGE: Ukuran berkas (${buf.length} byte) melebihi batas.`);
    }
    return buf;
  }

  throw new Error("DRIVE_REDIRECT_LIMIT: Terlalu banyak pengalihan URL saat mengunduh berkas.");
}

/**
 * Downloads a public Google Drive file safely with strict ID validation,
 * manual SSRF-checked redirect hops, and size/timeout caps.
 */
export async function downloadPublicDriveFileBuffer(params: {
  driveFileId: string;
  apiKey?: string;
  maxBytes?: number;
}): Promise<Buffer> {
  const fileId = params.driveFileId.trim();
  if (!DRIVE_FILE_ID_REGEX.test(fileId)) {
    throw new Error("INVALID_DRIVE_FILE_ID: ID berkas Google Drive tidak valid.");
  }

  const maxBytes = params.maxBytes ?? MAX_DOWNLOAD_BYTES;
  const key = params.apiKey?.trim();
  if (key) {
    try {
      const apiUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(key)}`;
      return await fetchWithValidatedRedirects(apiUrl, maxBytes);
    } catch {
      // Fall through to public uc?export=download endpoint
    }
  }

  const publicUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  return fetchWithValidatedRedirects(publicUrl, maxBytes);
}

/**
 * Extracts text on demand from a Drive file record if `extractedText` is still empty,
 * persisting the extracted text back to `drive_files` for subsequent runs.
 */
export async function ensureDriveFileExtracted(params: {
  userId: string;
  file: DriveFileRecord;
  apiKey?: string;
}): Promise<DriveExtractionOutcome> {
  const existing = params.file.extractedText?.trim();
  if (existing) {
    return {
      text: existing,
      extractionMethod: params.file.extractionMethod ?? "cached",
    };
  }

  if (
    !params.file.driveFileId ||
    params.file.driveFileId.startsWith("manual-") ||
    !EXTRACTABLE_EXT_RE.test(params.file.fileName)
  ) {
    return { text: null, error: "Format berkas tidak mendukung ekstraksi teks otomatis." };
  }

  try {
    const buffer = await downloadPublicDriveFileBuffer({
      driveFileId: params.file.driveFileId,
      apiKey: params.apiKey,
    });
    const parsed = await extractTextFromBuffer({
      buffer,
      fileName: params.file.fileName,
      mimeType: params.file.mimeType,
    });

    const trimmed = parsed.text.trim();
    if (!trimmed) {
      return {
        text: null,
        extractionMethod: parsed.extractionMethod,
        error: "Berkas tidak memiliki lapisan teks yang dapat diekstrak (kemungkinan pindaian gambar).",
      };
    }

    await updateDriveFileExtraction({
      userId: params.userId,
      fileId: params.file.id,
      extractedText: trimmed,
      extractionMethod: parsed.extractionMethod,
    });

    return { text: trimmed, extractionMethod: parsed.extractionMethod };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ekstraksi Drive gagal.";
    console.warn(`[DriveExtract Warning] file=${params.file.id}: ${message}`);
    return { text: null, error: message };
  }
}

export async function resolveAssesseeDitInputs(params: {
  userId: string;
  files: DriveFileRecord[];
  apiKey?: string;
}): Promise<{
  frIa04aText: string;
  presentationTranscript: string;
  candidateProfileSummary: string;
  extractionErrors: string[];
}> {
  const file04a = params.files.find((f) => f.docType === "04a") ?? null;
  const file04b = params.files.find((f) => f.docType === "04b") ?? null;
  const fileCv = params.files.find((f) => f.docType === "cv") ?? null;

  const [res04a, res04b, resCv] = await Promise.all([
    file04a ? ensureDriveFileExtracted({ userId: params.userId, file: file04a, apiKey: params.apiKey }) : null,
    file04b ? ensureDriveFileExtracted({ userId: params.userId, file: file04b, apiKey: params.apiKey }) : null,
    fileCv ? ensureDriveFileExtracted({ userId: params.userId, file: fileCv, apiKey: params.apiKey }) : null,
  ]);

  const extractionErrors: string[] = [];
  if (file04a && !res04a?.text && res04a?.error) extractionErrors.push(`04A (${file04a.fileName}): ${res04a.error}`);
  if (file04b && !res04b?.text && res04b?.error) extractionErrors.push(`04B (${file04b.fileName}): ${res04b.error}`);
  if (fileCv && !resCv?.text && resCv?.error) extractionErrors.push(`CV (${fileCv.fileName}): ${resCv.error}`);

  return {
    frIa04aText: res04a?.text ?? "",
    presentationTranscript: res04b?.text ?? "",
    candidateProfileSummary: resCv?.text ?? "",
    extractionErrors,
  };
}
