import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import { findBestMatchingCandidate } from "@/lib/names";
import {
  formatSchemeInstructionsText,
  selectDitInputFiles,
} from "@/lib/forms/dit-inputs";
import {
  updateDriveFileClassification,
  updateDriveFileExtraction,
  type DriveFileRecord,
} from "@/repositories/batches.repository";
import type { SchemeRecord } from "@/repositories/schemes.repository";
import {
  classifyDocumentTextContent,
  extractCandidateNamesFromDocumentText,
} from "@/services/drive";
import {
  EXTRACTABLE_TEXT_EXT_RE,
  extractTextFromBuffer,
  unpackSafeZipEntries,
} from "@/services/extract";

export { formatSchemeInstructionsText, selectDitInputFiles };

const DRIVE_FILE_ID_REGEX = /^[a-zA-Z0-9_-]{5,128}$/;
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_DRIVE_DOWNLOAD_DOMAINS = [
  "drive.google.com",
  "drive.usercontent.google.com",
  "googleusercontent.com",
  "www.googleapis.com",
];

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
  const sepIdx = fileId.indexOf("::");
  if (sepIdx > 0) {
    const parentDriveId = fileId.slice(0, sepIdx).trim();
    const entryPath = fileId
      .slice(sepIdx + 2)
      .replace(/^\/+/, "")
      .trim();
    if (
      !DRIVE_FILE_ID_REGEX.test(parentDriveId) ||
      !entryPath ||
      entryPath.split("/").includes("..")
    ) {
      throw new Error("INVALID_DRIVE_FILE_ID: ID berkas di dalam arsip ZIP tidak valid.");
    }
    const zipBuffer = await downloadPublicDriveFileBuffer({
      driveFileId: parentDriveId,
      apiKey: params.apiKey,
      maxBytes: params.maxBytes,
    });
    const entries = await unpackSafeZipEntries(zipBuffer);
    const target = entries.find((e) => e.entryPath === entryPath);
    if (!target) {
      throw new Error(`ZIP_ENTRY_NOT_FOUND: Berkas "${entryPath}" tidak ada dalam arsip ZIP.`);
    }
    return target.buffer;
  }

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

export type ExtractableDriveFileRef = Pick<
  DriveFileRecord,
  "id" | "driveFileId" | "fileName" | "mimeType" | "extractedText" | "extractionMethod"
> &
  Partial<DriveFileRecord>;

/**
 * Extracts text on demand from a Drive file record if `extractedText` is still empty,
 * persisting the extracted text back to `drive_files` for subsequent runs.
 */
export async function ensureDriveFileExtracted(params: {
  userId: string;
  file: ExtractableDriveFileRef;
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
    !EXTRACTABLE_TEXT_EXT_RE.test(params.file.fileName)
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

async function extractMultipleDriveFiles(params: {
  userId: string;
  files: DriveFileRecord[];
  apiKey?: string;
  labelPrefix: string;
  extractionErrors: string[];
}): Promise<string> {
  if (params.files.length === 0) return "";
  const chunks: string[] = [];
  const CONCURRENCY = 4;

  for (let i = 0; i < params.files.length; i += CONCURRENCY) {
    const slice = params.files.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(
      slice.map(async (file) => ({
        file,
        outcome: await ensureDriveFileExtracted({
          userId: params.userId,
          file,
          apiKey: params.apiKey,
        }),
      })),
    );
    for (const { file, outcome } of outcomes) {
      if (outcome.text) {
        chunks.push(
          `[Berkas ${params.labelPrefix}: ${file.fileName} (${file.docType})]\n${outcome.text}`,
        );
      } else if (outcome.error) {
        params.extractionErrors.push(`${file.fileName} (${file.docType}): ${outcome.error}`);
      }
    }
  }

  return chunks.join("\n\n---\n\n").trim();
}

export async function resolveAssesseeDitInputs(params: {
  userId: string;
  files: DriveFileRecord[];
  batchFiles?: DriveFileRecord[];
  scheme?: SchemeRecord | null;
  apiKey?: string;
}): Promise<{
  frIa04aText: string;
  frIa04aSource: "assessee" | "batch" | "scheme" | "none";
  presentationTranscript: string;
  candidateProfileSummary: string;
  extractionErrors: string[];
  used04aFiles: DriveFileRecord[];
  used04bFiles: DriveFileRecord[];
  usedDitFormFiles: DriveFileRecord[];
  usedCvFile: DriveFileRecord | null;
}> {
  const extractionErrors: string[] = [];

  const selected = selectDitInputFiles(params.files, params.batchFiles);
  const {
    assessee04a,
    sharedBatch04a,
    used04aFiles,
    used04bFiles,
    usedDitFormFiles,
    combinedDitFiles,
    usedCvFile: fileCv,
  } = selected;

  const [text04a, textDitParts, resCv] = await Promise.all([
    extractMultipleDriveFiles({
      userId: params.userId,
      files: used04aFiles,
      apiKey: params.apiKey,
      labelPrefix: "FR.IA.04A",
      extractionErrors,
    }),
    extractMultipleDriveFiles({
      userId: params.userId,
      files: combinedDitFiles,
      apiKey: params.apiKey,
      labelPrefix: "Tugas DIT",
      extractionErrors,
    }),
    fileCv
      ? ensureDriveFileExtracted({
          userId: params.userId,
          file: fileCv,
          apiKey: params.apiKey,
        })
      : null,
  ]);

  if (fileCv && !resCv?.text && resCv?.error) {
    extractionErrors.push(`CV (${fileCv.fileName}): ${resCv.error}`);
  }

  let frIa04aText = text04a;
  let frIa04aSource: "assessee" | "batch" | "scheme" | "none" =
    assessee04a.length > 0 && text04a
      ? "assessee"
      : sharedBatch04a.length > 0 && text04a
        ? "batch"
        : "none";

  if (!frIa04aText && params.scheme) {
    const schemeFallback = formatSchemeInstructionsText(params.scheme);
    if (schemeFallback) {
      frIa04aText = schemeFallback;
      frIa04aSource = "scheme";
    }
  }

  return {
    frIa04aText,
    frIa04aSource,
    presentationTranscript: textDitParts,
    candidateProfileSummary: resCv?.text ?? "",
    extractionErrors,
    used04aFiles,
    used04bFiles,
    usedDitFormFiles,
    usedCvFile: fileCv,
  };
}

export interface ContentEnrichableFile {
  id?: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  drivePath: string;
  docType: string;
  confidence?: number;
  classificationConfidence?: number;
  classificationReason?: string | null;
  triageReason?: string | null;
  extractedText?: string | null;
  extractionMethod?: string | null;
  assesseeId?: string | null;
}

/**
 * Unified content enrichment & classification engine shared by background Drive scans
 * (in-memory pre-persistence enrichment) and Triage actions (persistent reclassification
 * + optional unmatched assessee assignment).
 */
export async function enrichFilesByContent<T extends ContentEnrichableFile>(params: {
  files: T[];
  userId?: string;
  apiKey?: string;
  maxInspect?: number;
  includeUnmatched?: boolean;
  reassignAssessee?: boolean;
  persistUpdates?: boolean;
  assessees?: Array<{ id: string; displayName: string }>;
  cachedTextLookup?: (file: T) => string | null | undefined;
}): Promise<{ inspected: number; reclassified: number; reassigned: number }> {
  const maxInspect = params.maxInspect ?? 12;
  let inspected = 0;
  let reclassified = 0;
  let reassigned = 0;
  let networkBudgetUsed = 0;

  const networkQueue: Array<{ file: T; parentPath: string; currentConf: number }> = [];

  const applyClassification = async (
    file: T,
    text: string,
    extractionMethod: string | null,
    parentPath: string,
    currentConf: number,
  ) => {
    const contentCls = classifyDocumentTextContent(text, file.fileName, parentPath);
    const shouldUpgradeType =
      Boolean(contentCls) &&
      (Boolean(params.persistUpdates) ||
        file.docType === "unknown" ||
        (contentCls?.confidence ?? 0) > currentConf);

    let matchedAssesseeId = file.assesseeId ?? null;
    if (
      params.reassignAssessee &&
      !matchedAssesseeId &&
      params.assessees &&
      params.assessees.length > 0
    ) {
      const detectedType = contentCls?.docType ?? file.docType;
      const names = extractCandidateNamesFromDocumentText(detectedType, text);
      for (const candidateName of names) {
        const matched = findBestMatchingCandidate(candidateName, params.assessees);
        if (matched) {
          matchedAssesseeId = matched.id;
          reassigned++;
          break;
        }
      }
    }

    if (shouldUpgradeType && contentCls) {
      if (contentCls.docType !== file.docType) {
        reclassified++;
      }
      file.docType = contentCls.docType;
      file.confidence = contentCls.confidence;
      file.classificationConfidence = contentCls.confidence;
      file.classificationReason = contentCls.reason;
      file.triageReason = contentCls.reason;
    }

    if (
      params.persistUpdates &&
      params.userId &&
      file.id &&
      (contentCls || matchedAssesseeId !== (file.assesseeId ?? null))
    ) {
      const nextDocType = contentCls?.docType ?? file.docType;
      await updateDriveFileClassification({
        userId: params.userId,
        fileId: file.id,
        docType: nextDocType,
        confidence: contentCls?.confidence ?? currentConf,
        triageReason:
          contentCls?.reason ??
          file.triageReason ??
          "Teridentifikasi melalui isi teks dokumen.",
        extractedText: text,
        extractionMethod: extractionMethod ?? file.extractionMethod ?? null,
        assesseeId: matchedAssesseeId,
        triageStatus:
          nextDocType === "materi_pelatihan"
            ? "not_needed"
            : matchedAssesseeId
              ? "assigned"
              : "unmatched",
      });
    }
  };

  for (const file of params.files) {
    const currentConf = file.confidence ?? file.classificationConfidence ?? 0;
    const parentPath = file.drivePath.includes("/")
      ? file.drivePath.slice(0, file.drivePath.lastIndexOf("/"))
      : "";
    const cachedText = (params.cachedTextLookup?.(file) ?? file.extractedText ?? "").trim();

    if (cachedText) {
      inspected++;
      await applyClassification(
        file,
        cachedText,
        file.extractionMethod ?? null,
        parentPath,
        currentConf,
      );
      continue;
    }

    const dt = file.docType.toLowerCase();
    const isAmbiguous =
      dt === "unknown" ||
      dt === "portofolio" ||
      currentConf < 0.85 ||
      (Boolean(params.includeUnmatched) && !file.assesseeId);

    if (!isAmbiguous || !EXTRACTABLE_TEXT_EXT_RE.test(file.fileName)) continue;
    if (networkBudgetUsed >= maxInspect) continue;

    networkBudgetUsed++;
    networkQueue.push({ file, parentPath, currentConf });
  }

  const CONCURRENCY = 4;
  for (let i = 0; i < networkQueue.length; i += CONCURRENCY) {
    const chunk = networkQueue.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async ({ file, parentPath, currentConf }) => {
        inspected++;
        let text = "";
        let extractionMethod: string | null = null;

        try {
          if (params.persistUpdates && params.userId && file.id) {
            const extracted = await ensureDriveFileExtracted({
              userId: params.userId,
              file: {
                id: file.id,
                driveFileId: file.driveFileId,
                fileName: file.fileName,
                mimeType: file.mimeType,
                extractedText: file.extractedText ?? null,
                extractionMethod: file.extractionMethod ?? null,
              },
              apiKey: params.apiKey,
            });
            text = (extracted.text ?? "").trim();
            extractionMethod = extracted.extractionMethod ?? null;
          } else {
            const buffer = await downloadPublicDriveFileBuffer({
              driveFileId: file.driveFileId,
              apiKey: params.apiKey,
            });
            const parsed = await extractTextFromBuffer({
              buffer,
              fileName: file.fileName,
              mimeType: file.mimeType,
            });
            text = parsed.text.trim();
            extractionMethod = parsed.extractionMethod;
          }
        } catch {
          return;
        }

        if (!text) return;
        file.extractedText = text;
        file.extractionMethod = extractionMethod;
        await applyClassification(file, text, extractionMethod, parentPath, currentConf);
      }),
    );
  }

  return { inspected, reclassified, reassigned };
}

export async function reclassifyBatchFilesByContent(params: {
  userId: string;
  files: DriveFileRecord[];
  assessees: Array<{ id: string; displayName: string }>;
  apiKey?: string;
  maxInspect?: number;
}): Promise<{ inspected: number; reclassified: number; reassigned: number }> {
  return enrichFilesByContent({
    files: params.files,
    userId: params.userId,
    apiKey: params.apiKey,
    maxInspect: params.maxInspect ?? 12,
    includeUnmatched: true,
    reassignAssessee: true,
    persistUpdates: true,
    assessees: params.assessees,
  });
}
