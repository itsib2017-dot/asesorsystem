import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import { findBestMatchingCandidate } from "@/lib/names";
import { resolveSchemeKelompokPekerjaan } from "@/lib/forms/assessee-forms";
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
  deduplicateFilesByLatestRevision,
  pickLatestDriveFile,
} from "@/services/drive-revisions";
import {
  extractTextFromBuffer,
  unpackSafeZipEntries,
} from "@/services/extract";

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

export function formatSchemeInstructionsText(scheme?: SchemeRecord | null): string {
  if (!scheme) return "";
  const kelompok = resolveSchemeKelompokPekerjaan(scheme);
  if (kelompok.length === 0) return "";
  const lines: string[] = [
    `[Referensi Instruksi Tugas DIT dari Skema: ${scheme.name}]`,
  ];
  for (const kp of kelompok) {
    lines.push(`\nKelompok Pekerjaan ${kp.kpIndex}: ${kp.title}`);
    for (const u of kp.units) {
      lines.push(`- Unit ${u.code}: ${u.title}`);
    }
    for (const a of kp.aspects) {
      lines.push(
        `  • Aspek ${a.no} (${a.unitCode} — ${a.lingkup}): ${a.question} [KUK: ${a.kukRef}]`,
      );
    }
  }
  return lines.join("\n").trim();
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

  const assessee04a = deduplicateFilesByLatestRevision(
    params.files.filter((f) => f.docType === "04a"),
  );
  const sharedBatch04a =
    assessee04a.length === 0 && params.batchFiles
      ? deduplicateFilesByLatestRevision(
          params.batchFiles.filter((f) => !f.assesseeId && f.docType === "04a"),
        )
      : [];
  const used04aFiles = assessee04a.length > 0 ? assessee04a : sharedBatch04a;

  const used04bFiles = deduplicateFilesByLatestRevision(
    params.files.filter((f) => f.docType === "04b"),
  );
  const usedDitFormFiles = deduplicateFilesByLatestRevision(
    params.files.filter((f) => f.docType === "dit_form"),
  );

  const fileCv =
    pickLatestDriveFile(params.files.filter((f) => f.docType === "cv")) ??
    pickLatestDriveFile(params.files.filter((f) => f.docType === "portofolio"));

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
      files: [...used04bFiles, ...usedDitFormFiles],
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

export async function reclassifyBatchFilesByContent(params: {
  userId: string;
  files: DriveFileRecord[];
  assessees: Array<{ id: string; displayName: string }>;
  apiKey?: string;
  maxInspect?: number;
}): Promise<{ inspected: number; reclassified: number; reassigned: number }> {
  const maxInspect = params.maxInspect ?? 12;
  const candidates = params.files
    .filter((f) => {
      if (!EXTRACTABLE_EXT_RE.test(f.fileName)) return false;
      const dt = f.docType.toLowerCase();
      return (
        dt === "unknown" ||
        dt === "portofolio" ||
        f.classificationConfidence < 0.85 ||
        !f.assesseeId
      );
    })
    .slice(0, maxInspect);

  let inspected = 0;
  let reclassified = 0;
  let reassigned = 0;

  const CONCURRENCY = 4;
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const chunk = candidates.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (file) => {
        inspected++;
        const extracted = await ensureDriveFileExtracted({
          userId: params.userId,
          file,
          apiKey: params.apiKey,
        });
        const text = extracted.text ?? "";
        if (!text) return;

        const folderParent = file.drivePath.includes("/")
          ? file.drivePath.slice(0, file.drivePath.lastIndexOf("/"))
          : "";
        const contentCls = classifyDocumentTextContent(
          text,
          file.fileName,
          folderParent,
        );

        let matchedAssesseeId = file.assesseeId ?? null;
        if (!matchedAssesseeId && params.assessees.length > 0) {
          const detectedType = contentCls?.docType ?? file.docType;
          const names = extractCandidateNamesFromDocumentText(detectedType, text);
          for (const candidateName of names) {
            const matched = findBestMatchingCandidate(
              candidateName,
              params.assessees,
            );
            if (matched) {
              matchedAssesseeId = matched.id;
              reassigned++;
              break;
            }
          }
        }

        if (contentCls || matchedAssesseeId !== file.assesseeId) {
          if (contentCls && contentCls.docType !== file.docType) {
            reclassified++;
          }
          await updateDriveFileClassification({
            userId: params.userId,
            fileId: file.id,
            docType: contentCls?.docType ?? file.docType,
            confidence: contentCls?.confidence ?? file.classificationConfidence,
            triageReason:
              contentCls?.reason ??
              file.triageReason ??
              "Teridentifikasi melalui isi teks dokumen.",
            extractedText: text,
            extractionMethod: extracted.extractionMethod ?? file.extractionMethod ?? null,
            assesseeId: matchedAssesseeId,
            triageStatus:
              (contentCls?.docType ?? file.docType) === "materi_pelatihan"
                ? "not_needed"
                : matchedAssesseeId
                  ? "assigned"
                  : "unmatched",
          });
        }
      }),
    );
  }

  return { inspected, reclassified, reassigned };
}
