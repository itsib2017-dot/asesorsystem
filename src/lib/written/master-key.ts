import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { decryptAgileOoxmlBuffer } from "@/lib/written/ooxml-decrypt";
import {
  getDriveFileByDriveFileId,
  setBatchActiveMasterKey,
  upsertDriveFilesForBatch,
  type BatchSummary,
  type DriveFileRecord,
  type MasterKeySource,
  type MasterKeyValidationStatus,
} from "@/repositories/batches.repository";
import { extractTextFromDocx, isOleEncryptedBuffer } from "@/services/extract";

export interface MasterKeyContentValidation {
  valid: boolean;
  status: MasterKeyValidationStatus;
  summary: string;
  substantiveChars: number;
  substantiveWords: number;
  detectedBlanko?: boolean;
  detectedQuestionSheet06a?: boolean;
}

export type MasterKeyParseResult =
  | {
      ok: true;
      fileName: string;
      mimeType: string;
      text: string;
      extractionMethod: "raw_text" | "ooxml_docx";
      validation: MasterKeyContentValidation;
    }
  | {
      ok: false;
      error: string;
      validation?: MasterKeyContentValidation;
    };

export interface MasterKeyCandidateView {
  id: string;
  fileName: string;
  drivePath: string;
  origin: MasterKeySource;
  originLabel: string;
  isActive: boolean;
  isEncryptedOrUnextracted: boolean;
  validation: MasterKeyContentValidation;
  canActivate: boolean;
  statusLabel: string;
  reasonSummary: string;
}

export interface ResolvedBatchMasterKey {
  activeFile: DriveFileRecord | null;
  activeOrigin: MasterKeySource | null;
  activeOriginLabel: string | null;
  validation: MasterKeyContentValidation | null;
  isReadyForGrading: boolean;
  activatedAt: string | null;
  blockingWarning: string | null;
  candidates: MasterKeyCandidateView[];
}

const MAX_KEY_BYTES = 10 * 1024 * 1024;

const BNSP_METADATA_KEY_VALUE_RE =
  /^(?:skema\s+sertifikasi|judul(?:\s+skema|\s+unit)?|nomor|no\.?\s*skema|tuk|nama\s+asesor|nama\s+asesi|tanggal|waktu|kode\s+unit|kelompok\s+pekerjaan(?:\s*\d+)?)\s*:/i;

const BNSP_STANDALONE_LABEL_RE =
  /^(?:fr\.?\s*ia\.?\s*06[abc]?\.?|(?:lembar\s+)?(?:kunci\s+)?jawaban(?:\s+pertanyaan\s+tertulis(?:\s*[-–—:]?\s*esai)?)?|(?:dpt\s*[–—-]\s*)?daftar\s+pertanyaan\s+tertulis(?:\s+esai)?|skema\s+sertifikasi|\(?\s*kkni\s*\/\s*okupasi\s*\/\s*klaster\s*\)?|judul(?:\s+unit)?|nomor|no\.?|tuk|sewaktu\s*\/\s*tempat\s+kerja\s*\/\s*mandiri\*?|nama(?:\s+asesor|\s+asesi)?|tanggal|waktu|kode\s+unit|pencapaian|ya|tidak|catatan|soal|pertanyaan|jabatan|no\.?\s*reg|kelompok\s+pekerjaan(?:\s*\d+)?|\*?\s*coret\s+yang\s+tidak\s+perlu\s*\*?|(?:tanda\s+tangan(?:\s*(?:&|dan)\s*tanggal)?|penyusun\s+dan\s+validator|mengetahui\/validator|asesor|asesi)\s*:?)$/i;

const PLACEHOLDER_VALUE_RE =
  /^(?:\[?\s*(?:isi|tulis(?:kan)?|masukkan)\s+(?:kunci\s+)?jawaban(?:\s+di\s+sini)?\s*\]?|belum\s+diisi|kosong|tba|n\/a|\.{2,}|_{2,}|-{2,}|(?:[a-z]\s*[).]\s*)+|[\s:.,;_/*\-–—()\[\]0-9]+)$/i;

/**
 * Validates that extracted FR.IA.06B text contains actual substantive answer key prose,
 * rejecting empty documents, unaltered BNSP blanko skeletons, and pure FR.IA.06A question sheets.
 */
export function validateMasterKey06bContent(
  rawText: string | null | undefined,
): MasterKeyContentValidation {
  const trimmed = (rawText ?? "").trim();
  if (!trimmed) {
    return {
      valid: false,
      status: "empty_or_blanko",
      summary: "Teks kunci jawaban 06B kosong atau belum berisi jawaban kunci.",
      substantiveChars: 0,
      substantiveWords: 0,
      detectedBlanko: true,
    };
  }

  if (/^\[Dokumen berisi \d+ gambar tersemat/i.test(trimmed)) {
    return {
      valid: false,
      status: "empty_or_blanko",
      summary: "Dokumen hanya memuat gambar tanpa lapisan teks kunci jawaban yang dapat dibaca.",
      substantiveChars: 0,
      substantiveWords: 0,
      detectedBlanko: true,
    };
  }

  const has06aHeader =
    /\bfr\.?\s*ia\.?\s*06\s*a\b|dpt\s*[–—-]\s*daftar\s+pertanyaan\s+tertulis|daftar\s+pertanyaan\s+tertulis\s+esai/i.test(
      trimmed,
    );
  const has06bHeader =
    /\bfr\.?\s*ia\.?\s*06\s*b\b|lembar\s+kunci\s+jawaban|\bkunci\s+jawaban\b/i.test(trimmed);

  if (has06aHeader && !has06bHeader) {
    return {
      valid: false,
      status: "empty_or_blanko",
      summary:
        "Berkas terdeteksi sebagai lembar daftar soal (FR.IA.06A), bukan lembar kunci jawaban (FR.IA.06B).",
      substantiveChars: 0,
      substantiveWords: 0,
      detectedQuestionSheet06a: true,
    };
  }

  const hasBnspFormWrapper =
    /\bfr\.?\s*ia\.?\s*06[bc]?\b|lembar\s+(?:kunci\s+)?jawaban|pertanyaan\s+tertulis\s+esai/i.test(
      trimmed,
    ) &&
    /\bskema\s+sertifikasi|\bkode\s+unit|\bpencapaian|\bumpan\s+balik|\bpenyusun\s+dan\s+validator\b/i.test(
      trimmed,
    );

  let lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let usedBodyMarker = false;
  if (hasBnspFormWrapper) {
    const bodyStartIdx = lines.findIndex(
      (line, idx) =>
        idx >= 2 &&
        idx < 60 &&
        /^(?:kunci\s+jawaban(?:\s+pertanyaan\s+tertulis(?:\s*[-–—:]?\s*esai)?)?|jawaban(?:\s+pertanyaan)?)\s*:?\s*$/i.test(
          line,
        ),
    );
    if (bodyStartIdx !== -1) {
      lines = lines.slice(bodyStartIdx + 1);
      usedBodyMarker = true;
    }

    const footerIdx = lines.findIndex((line) =>
      /^(?:umpan\s+balik(?:\s+untuk\s+asesi)?|aspek\s+pengetahuan\s+seluruh\s+unit|tuliskan\s+unit\/elemen|penyusun\s+dan\s+validator|mengetahui\s*\/?\s*validator|asesi\s*:)\b/i.test(
        line,
      ),
    );
    if (footerIdx !== -1) {
      lines = lines.slice(0, footerIdx);
    }
  }

  const substantiveLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line) continue;

    if (hasBnspFormWrapper && !usedBodyMarker && i < 30) {
      if (BNSP_METADATA_KEY_VALUE_RE.test(line)) continue;
      const next = lines[i + 1] ?? "";
      if (
        /^(?:judul(?:\s+unit)?|nomor|kode\s+unit|skema\s+sertifikasi|tuk|kelompok\s+pekerjaan)$/i.test(
          line,
        ) &&
        next === ":"
      ) {
        // Skip metadata label, colon, and its value line
        i += 2;
        continue;
      }
    }

    if (BNSP_STANDALONE_LABEL_RE.test(line)) continue;
    if (PLACEHOLDER_VALUE_RE.test(line)) continue;

    const stripped = line.replace(/^\s*(?:\d{1,3}|[a-z])\s*[.)]\s+/i, "").trim();
    if (!stripped || PLACEHOLDER_VALUE_RE.test(stripped) || BNSP_STANDALONE_LABEL_RE.test(stripped)) {
      continue;
    }

    substantiveLines.push(stripped);
  }

  const joined = substantiveLines.join(" ").replace(/\s+/g, " ").trim();
  const wordMatches = joined.match(/[a-zA-ZÀ-ÿ]{2,}/g) ?? [];
  const substantiveWords = wordMatches.length;
  const substantiveChars = joined.length;

  const minChars = hasBnspFormWrapper ? 40 : 30;
  const minWords = hasBnspFormWrapper ? 8 : 6;

  if (substantiveChars < minChars || substantiveWords < minWords) {
    return {
      valid: false,
      status: "empty_or_blanko",
      summary: hasBnspFormWrapper
        ? "Berkas hanya memuat kerangka/header blanko FR.IA.06B tanpa teks kunci jawaban."
        : "Teks kunci jawaban 06B kosong atau belum memuat isi jawaban kunci yang memadai.",
      substantiveChars,
      substantiveWords,
      detectedBlanko: true,
    };
  }

  return {
    valid: true,
    status: "valid",
    summary: `Lolos validasi isi: terdeteksi ${substantiveWords} kata (${substantiveChars} karakter) teks kunci jawaban.`,
    substantiveChars,
    substantiveWords,
  };
}

export function classifyMasterKeyOrigin(file: DriveFileRecord): MasterKeySource {
  if (file.driveFileId.startsWith("manual-06b-text-")) return "manual_text";
  if (file.driveFileId.startsWith("manual-06b-") || file.drivePath.startsWith("Manual Upload/")) {
    return "assessor_upload";
  }
  if (file.archiveEntryPath || file.driveFileId.includes("::")) return "archive_extract";
  return "drive_file";
}

export function formatMasterKeySourceLabel(source: MasterKeySource | null): string {
  switch (source) {
    case "assessor_upload":
      return "Unggahan Asesor";
    case "manual_text":
      return "Teks Manual Asesor";
    case "archive_extract":
      return "Ekstrak Arsip MUK";
    case "drive_file":
      return "Berkas Google Drive";
    default:
      return "Tidak Diketahui";
  }
}

/**
 * Single source of truth resolving whether a batch has an explicitly activated,
 * content-validated FR.IA.06B working master key vs. inactive/blanko candidates.
 */
export function resolveBatchActiveMasterKey(
  batch: BatchSummary,
  files: DriveFileRecord[],
): ResolvedBatchMasterKey {
  const candidates06b = files.filter((f) => f.docType.toLowerCase() === "06b");
  const activeId = batch.activeMasterKeyFileId;

  const candidates: MasterKeyCandidateView[] = candidates06b.map((file) => {
    const origin =
      activeId && file.id === activeId && batch.activeMasterKeySource
        ? batch.activeMasterKeySource
        : classifyMasterKeyOrigin(file);
    const isEncryptedOrUnextracted = !(file.extractedText ?? "").trim();
    const validation = isEncryptedOrUnextracted
      ? {
          valid: false,
          status: (origin === "archive_extract"
            ? "encrypted_unreadable"
            : "empty_or_blanko") as MasterKeyValidationStatus,
          summary:
            "Berkas belum memiliki teks jawaban yang terbaca (kemungkinan blanko terenkripsi kata sandi).",
          substantiveChars: 0,
          substantiveWords: 0,
          detectedBlanko: true,
        }
      : validateMasterKey06bContent(file.extractedText);

    const isActive = Boolean(activeId && file.id === activeId);
    const canActivate = !isEncryptedOrUnextracted && validation.valid;

    let statusLabel: string;
    if (isActive && canActivate) {
      statusLabel = "Aktif & Terverifikasi";
    } else if (isActive) {
      statusLabel = "Aktif Namun Gagal Validasi";
    } else if (isEncryptedOrUnextracted) {
      statusLabel = "Tidak Aktif (Blanko / Terenkripsi)";
    } else if (!validation.valid) {
      statusLabel = "Tidak Aktif (Blanko Kosong / Bukan Kunci)";
    } else {
      statusLabel = "Tidak Aktif — Siap Diaktifkan";
    }

    const reasonSummary = isEncryptedOrUnextracted
      ? file.triageReason || validation.summary
      : validation.summary;

    return {
      id: file.id,
      fileName: file.fileName,
      drivePath: file.drivePath,
      origin,
      originLabel: formatMasterKeySourceLabel(origin),
      isActive,
      isEncryptedOrUnextracted,
      validation,
      canActivate,
      statusLabel,
      reasonSummary,
    };
  });

  candidates.sort((a, b) => Number(b.isActive) - Number(a.isActive));

  const activeCandidate = candidates.find((c) => c.isActive) ?? null;
  const activeFile = activeCandidate
    ? (candidates06b.find((f) => f.id === activeCandidate.id) ?? null)
    : null;
  const activeOrigin = activeCandidate
    ? (batch.activeMasterKeySource ?? activeCandidate.origin)
    : null;
  const activeOriginLabel = activeOrigin ? formatMasterKeySourceLabel(activeOrigin) : null;
  const validation = activeCandidate?.validation ?? null;
  const isReadyForGrading = Boolean(
    activeFile &&
      validation?.valid &&
      batch.activeMasterKeyValidationStatus === "valid",
  );

  let blockingWarning: string | null = null;
  if (!isReadyForGrading) {
    if (activeFile && validation && !validation.valid) {
      blockingWarning = `Kunci 06B "${activeFile.fileName}" tidak lolos validasi isi (${validation.summary}). Nonaktifkan dan unggah/aktifkan kunci 06B kerja yang berisi jawaban sebelum menjalankan koreksi.`;
    } else if (candidates.some((c) => c.origin === "archive_extract" || !c.validation.valid)) {
      blockingWarning =
        "Belum ada kunci jawaban 06B kerja yang aktif. Berkas FR.IA.06B dari arsip MUK adalah blanko/terenkripsi (tanpa jawaban kunci) dan dinonaktifkan otomatis agar koreksi tertulis tidak menilai terhadap kunci kosong. Unggah kunci 06B kerja (.docx / .txt) terlebih dahulu.";
    } else if (candidates.some((c) => c.canActivate)) {
      blockingWarning =
        "Kandidat berkas 06B tersedia di batch, namun belum ditandai aktif. Tinjau dan tandai kunci 06B kerja sebagai Kunci Aktif di Detail Batch sebelum menjalankan koreksi tertulis.";
    } else {
      blockingWarning =
        "Belum ada berkas kunci jawaban FR.IA.06B yang aktif di batch ini. Unggah kunci 06B kerja (.docx / .txt) untuk mengaktifkan koreksi tertulis.";
    }
  }

  return {
    activeFile,
    activeOrigin,
    activeOriginLabel,
    validation,
    isReadyForGrading,
    activatedAt: batch.activeMasterKeyActivatedAt,
    blockingWarning,
    candidates,
  };
}

export async function parseMasterKey06bFile(
  fileObj: File,
  runtimePassword?: string,
): Promise<MasterKeyParseResult> {
  if (fileObj.size <= 0) {
    return { ok: false, error: "Berkas kunci 06B kosong." };
  }
  if (fileObj.size > MAX_KEY_BYTES) {
    return { ok: false, error: "Ukuran file kunci 06B maksimal 10 MB." };
  }

  const fileNameLower = fileObj.name.toLowerCase();
  if (!fileNameLower.endsWith(".docx") && !fileNameLower.endsWith(".txt")) {
    return {
      ok: false,
      error: "Format berkas kunci 06B harus .docx atau .txt.",
    };
  }

  try {
    let buffer: Buffer = Buffer.from(await fileObj.arrayBuffer());
    if (fileNameLower.endsWith(".txt")) {
      const text = buffer.toString("utf8").trim();
      const validation = validateMasterKey06bContent(text);
      if (!validation.valid) {
        return {
          ok: false,
          error: `Kunci 06B ditolak: ${validation.summary}`,
          validation,
        };
      }
      return {
        ok: true,
        fileName: fileObj.name,
        mimeType: fileObj.type || "text/plain",
        text,
        extractionMethod: "raw_text",
        validation,
      };
    }

    if (isOleEncryptedBuffer(buffer)) {
      buffer = decryptAgileOoxmlBuffer(buffer, runtimePassword ?? "");
    }

    const parsed = await extractTextFromDocx(buffer);
    const trimmedText = parsed.text.trim();
    const validation = validateMasterKey06bContent(trimmedText);
    if (!validation.valid) {
      return {
        ok: false,
        error: `Kunci 06B ditolak: ${validation.summary}`,
        validation,
      };
    }

    return {
      ok: true,
      fileName: fileObj.name,
      mimeType:
        fileObj.type ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      text: trimmedText,
      extractionMethod: "ooxml_docx",
      validation,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gagal membaca berkas kunci 06B.",
    };
  }
}

export async function persistBatchMasterKey06b(params: {
  userId: string;
  lspId: string;
  batchId: string;
  fileName: string;
  mimeType: string;
  text: string;
  extractionMethod: "raw_text" | "ooxml_docx";
  assesseeId?: string;
  hasUploadedFile: boolean;
  source?: MasterKeySource;
  auditAction?: string;
  usedRuntimePassword?: boolean;
}): Promise<
  | { ok: true; fileId: string; validation: MasterKeyContentValidation }
  | { ok: false; error: string; validation: MasterKeyContentValidation }
> {
  const validation = validateMasterKey06bContent(params.text);
  if (!validation.valid) {
    return {
      ok: false,
      error: `Kunci 06B ditolak: ${validation.summary}`,
      validation,
    };
  }

  const source: MasterKeySource =
    params.source ?? (params.hasUploadedFile ? "assessor_upload" : "manual_text");
  const driveFileId = params.hasUploadedFile
    ? `manual-06b-${params.batchId}`
    : `manual-06b-text-${params.batchId}`;
  const nowIso = new Date().toISOString();

  await upsertDriveFilesForBatch({
    userId: params.userId,
    lspId: params.lspId,
    batchId: params.batchId,
    files: [
      {
        driveFileId,
        fileName: params.fileName,
        mimeType: params.mimeType,
        drivePath: `Manual Upload/${params.fileName}`,
        docType: "06b",
        confidence: 1,
        assesseeId: null,
        triageStatus: "assigned",
        triageReason: `Kunci 06B kerja (${formatMasterKeySourceLabel(source)} — ${validation.summary})`,
        extractedText: params.text.trim(),
        extractionMethod: params.extractionMethod,
        driveModifiedTime: nowIso,
      },
    ],
  });

  const savedFile = await getDriveFileByDriveFileId(
    params.userId,
    params.batchId,
    driveFileId,
  );
  if (!savedFile) {
    return {
      ok: false,
      error: "Berkas kunci 06B tersimpan, tetapi gagal ditautkan sebagai kunci aktif batch.",
      validation,
    };
  }

  const activationRes = await setBatchActiveMasterKey({
    userId: params.userId,
    batchId: params.batchId,
    fileId: savedFile.id,
    source,
    validationStatus: validation.status,
    validationSummary: validation.summary,
    activatedAt: nowIso,
  });

  if (!activationRes.ok) {
    return {
      ok: false,
      error: activationRes.error,
      validation,
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: params.lspId,
        actor_id: params.userId,
        action: params.auditAction ?? "written.key_06b.upload",
        resource: "batches",
        resource_id: params.batchId,
        after_summary: {
          fileId: savedFile.id,
          fileName: params.fileName,
          source,
          validationStatus: validation.status,
          hasUploadedFile: params.hasUploadedFile,
          masterKeyChars: params.text.trim().length,
          usedRuntimePassword: Boolean(params.usedRuntimePassword),
          ...(params.assesseeId ? { assesseeId: params.assesseeId } : {}),
        },
      },
      supabase,
    );
  } catch (err) {
    console.warn("[MasterKey06b] audit log failed:", err instanceof Error ? err.message : String(err));
  }

  return { ok: true, fileId: savedFile.id, validation };
}
