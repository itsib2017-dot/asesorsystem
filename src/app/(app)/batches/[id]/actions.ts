"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { requireLspRole } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { decryptAgileOoxmlBuffer } from "@/lib/written/ooxml-decrypt";
import {
  classifyMasterKeyOrigin,
  parseMasterKey06bFile,
  persistBatchMasterKey06b,
  validateMasterKey06bContent,
} from "@/lib/written/master-key";
import {
  listAssesseesByBatch,
  upsertAssesseesForBatch,
} from "@/repositories/assessees.repository";
import {
  clearBatchActiveMasterKey,
  getBatchById,
  getDriveFileById,
  setBatchActiveMasterKey,
  updateBatchMetadata,
  updateDriveFileExtraction,
  updateDriveFileTriage,
  upsertDriveFilesForBatch,
  type DriveFileRecord,
} from "@/repositories/batches.repository";
import { downloadPublicDriveFileBuffer } from "@/services/drive-extract";
import {
  extractTextFromBuffer,
  extractTextFromDocx,
  isOleEncryptedBuffer,
} from "@/services/extract";
import { parseSuratTugasText, type ParsedSuratTugasResult } from "@/services/surat-tugas";

const BatchIdSchema = z.object({
  batchId: z.string().uuid("Parameter batchId tidak valid."),
});

const ActivateBatchKeySchema = z.object({
  batchId: z.string().uuid("Parameter batchId tidak valid."),
  fileId: z.string().uuid("Parameter fileId tidak valid."),
});

async function tryResolveCandidate06bText(
  userId: string,
  file: DriveFileRecord,
  runtimePassword?: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const cached = (file.extractedText ?? "").trim();
  if (cached) {
    return { ok: true, text: cached };
  }

  const canAttemptRemoteExtract =
    !file.driveFileId.startsWith("manual-") &&
    (Boolean(runtimePassword) || !file.archiveEntryPath);

  if (!canAttemptRemoteExtract) {
    return {
      ok: false,
      error:
        "Berkas 06B ini tidak memiliki teks jawaban yang dapat dibaca (blanko kosong atau terenkripsi) — tidak dapat diaktifkan.",
    };
  }

  try {
    let buffer = await downloadPublicDriveFileBuffer({ driveFileId: file.driveFileId });
    if (file.fileName.toLowerCase().endsWith(".docx") && isOleEncryptedBuffer(buffer)) {
      buffer = decryptAgileOoxmlBuffer(buffer, runtimePassword ?? "");
      const parsedDocx = await extractTextFromDocx(buffer);
      const text = parsedDocx.text.trim();
      if (!text) {
        return {
          ok: false,
          error: "Berkas 06B terdekripsi, namun tidak memuat teks kunci jawaban.",
        };
      }
      await updateDriveFileExtraction({
        userId,
        fileId: file.id,
        extractedText: text,
        extractionMethod: "ooxml_docx",
      });
      return { ok: true, text };
    }

    const parsed = await extractTextFromBuffer({
      buffer,
      fileName: file.fileName,
      mimeType: file.mimeType,
    });
    const text = parsed.text.trim();
    if (!text) {
      return {
        ok: false,
        error:
          "Berkas 06B ini tidak memiliki teks jawaban yang dapat dibaca (blanko kosong atau gambar scan) — tidak dapat diaktifkan.",
      };
    }
    await updateDriveFileExtraction({
      userId,
      fileId: file.id,
      extractedText: text,
      extractionMethod: parsed.extractionMethod,
    });
    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Berkas 06B tidak dapat dibaca atau didekripsi.",
    };
  }
}

export async function uploadBatchMasterKey06bAction(formData: FormData): Promise<{
  ok: boolean;
  fileName?: string;
  validationSummary?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const parsedInput = BatchIdSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
  });
  if (!parsedInput.success) {
    return { ok: false, error: parsedInput.error.issues[0]?.message ?? "Parameter tidak valid." };
  }
  const { batchId } = parsedInput.data;

  const uploadedFile = formData.get("masterKeyFile");
  if (!uploadedFile || typeof uploadedFile !== "object" || !("arrayBuffer" in uploadedFile)) {
    return { ok: false, error: "Pilih berkas FR.IA.06B (.docx atau .txt)." };
  }

  const rawPassword = formData.get("masterKeyPassword");
  const runtimePassword =
    typeof rawPassword === "string" && rawPassword.length > 0 ? rawPassword : undefined;

  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };
  }

  const roleCheck = await requireLspRole(batch.lspId, user.id, ["lsp_admin", "assessor"]);
  if (!roleCheck.allowed) {
    return {
      ok: false,
      error: "Akses ditolak: hanya Asesor atau Admin LSP yang dapat mengelola kunci jawaban 06B.",
    };
  }

  const parsed = await parseMasterKey06bFile(uploadedFile as File, runtimePassword);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const persisted = await persistBatchMasterKey06b({
    userId: user.id,
    lspId: batch.lspId,
    batchId: batch.id,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    text: parsed.text,
    extractionMethod: parsed.extractionMethod,
    hasUploadedFile: true,
    source: "assessor_upload",
    auditAction: "batch.key_06b.upload",
    usedRuntimePassword: Boolean(runtimePassword),
  });

  if (!persisted.ok) {
    return { ok: false, error: persisted.error };
  }

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/triage`);
  revalidatePath("/settings/audit");
  return {
    ok: true,
    fileName: parsed.fileName,
    validationSummary: persisted.validation.summary,
  };
}

export async function activateBatchMasterKey06bAction(formData: FormData): Promise<{
  ok: boolean;
  fileName?: string;
  validationSummary?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const parsedInput = ActivateBatchKeySchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    fileId: String(formData.get("fileId") ?? "").trim(),
  });
  if (!parsedInput.success) {
    return { ok: false, error: parsedInput.error.issues[0]?.message ?? "Parameter tidak valid." };
  }
  const { batchId, fileId } = parsedInput.data;

  const rate = checkRateLimit(`key06b:activate:${user.id}:${batchId}`, 20, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak percobaan aktivasi kunci 06B. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const rawPassword = formData.get("masterKeyPassword");
  const runtimePassword =
    typeof rawPassword === "string" && rawPassword.length > 0 ? rawPassword : undefined;

  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };
  }

  const roleCheck = await requireLspRole(batch.lspId, user.id, ["lsp_admin", "assessor"]);
  if (!roleCheck.allowed) {
    return {
      ok: false,
      error: "Akses ditolak: hanya Asesor atau Admin LSP yang dapat mengaktifkan kunci jawaban 06B.",
    };
  }

  const file = await getDriveFileById(user.id, fileId);
  if (!file || file.batchId !== batch.id || file.docType.toLowerCase() !== "06b") {
    return { ok: false, error: "Berkas kandidat kunci 06B tidak ditemukan pada batch ini." };
  }

  const source = classifyMasterKeyOrigin(file);
  const textRes = await tryResolveCandidate06bText(user.id, file, runtimePassword);

  const validation = textRes.ok
    ? validateMasterKey06bContent(textRes.text)
    : {
        valid: false as const,
        status: (source === "archive_extract"
          ? "encrypted_unreadable"
          : "empty_or_blanko") as "encrypted_unreadable" | "empty_or_blanko",
        summary: textRes.error,
        substantiveChars: 0,
        substantiveWords: 0,
      };

  if (!validation.valid) {
    try {
      const supabase = await getSupabaseServerClient();
      await writeAuditLog(
        {
          lsp_id: batch.lspId,
          actor_id: user.id,
          action: "batch.key_06b.activate.rejected",
          resource: "batches",
          resource_id: batch.id,
          after_summary: {
            fileId: file.id,
            fileName: file.fileName,
            source,
            validationStatus: validation.status,
            substantiveWords: validation.substantiveWords,
            rejectionReason: validation.summary,
          },
        },
        supabase,
      );
    } catch (err) {
      console.warn("[MasterKey06bActivateRejected] audit log failed:", err instanceof Error ? err.message : String(err));
    }

    revalidatePath(`/batches/${batchId}`);
    revalidatePath("/settings/audit");
    return {
      ok: false,
      fileName: file.fileName,
      validationSummary: `${validation.status} (${validation.substantiveWords} kata substantif): ${validation.summary}`,
      error: `Aktivasi kunci "${file.fileName}" ditolak [${validation.status} · ${validation.substantiveWords} kata]: ${validation.summary}`,
    };
  }

  const activated = await setBatchActiveMasterKey({
    userId: user.id,
    batchId: batch.id,
    fileId: file.id,
    source,
    validationStatus: validation.status,
    validationSummary: validation.summary,
  });

  if (!activated.ok) {
    return { ok: false, error: activated.error };
  }

  await updateDriveFileTriage({
    userId: user.id,
    fileId: file.id,
    assesseeId: null,
    docType: "06b",
    triageStatus: "assigned",
    triageReason: `Kunci 06B aktif (${validation.summary})`,
  });

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "batch.key_06b.activate",
        resource: "batches",
        resource_id: batch.id,
        after_summary: {
          fileId: file.id,
          fileName: file.fileName,
          source,
          validationStatus: validation.status,
          substantiveWords: validation.substantiveWords,
        },
      },
      supabase,
    );
  } catch (err) {
    console.warn("[MasterKey06bActivate] audit log failed:", err instanceof Error ? err.message : String(err));
  }

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/triage`);
  revalidatePath("/settings/audit");
  return {
    ok: true,
    fileName: file.fileName,
    validationSummary: validation.summary,
  };
}

export async function deactivateBatchMasterKey06bAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const parsedInput = BatchIdSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
  });
  if (!parsedInput.success) {
    return { ok: false, error: parsedInput.error.issues[0]?.message ?? "Parameter tidak valid." };
  }
  const { batchId } = parsedInput.data;

  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };
  }

  const roleCheck = await requireLspRole(batch.lspId, user.id, ["lsp_admin", "assessor"]);
  if (!roleCheck.allowed) {
    return {
      ok: false,
      error: "Akses ditolak: hanya Asesor atau Admin LSP yang dapat menonaktifkan kunci 06B.",
    };
  }

  const previousFileId = batch.activeMasterKeyFileId;
  await clearBatchActiveMasterKey({ userId: user.id, batchId: batch.id });

  if (previousFileId) {
    const prevFile = await getDriveFileById(user.id, previousFileId);
    if (prevFile && prevFile.batchId === batch.id) {
      await updateDriveFileTriage({
        userId: user.id,
        fileId: prevFile.id,
        assesseeId: null,
        docType: "06b",
        triageStatus: "not_needed",
        triageReason: "Dinonaktifkan oleh asesor — tidak dipakai sebagai kunci aktif",
      });
    }
  }

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "batch.key_06b.deactivate",
        resource: "batches",
        resource_id: batch.id,
        after_summary: {
          deactivatedFileId: previousFileId,
        },
      },
      supabase,
    );
  } catch (err) {
    console.warn("[MasterKey06bDeactivate] audit log failed:", err instanceof Error ? err.message : String(err));
  }

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/triage`);
  revalidatePath("/settings/audit");
  return { ok: true };
}

const MAX_SURAT_TUGAS_BYTES = 10 * 1024 * 1024;
const ALLOWED_SURAT_TUGAS_EXT_RE = /\.(pdf|docx|txt)$/i;

const UpdateBatchMetadataSchema = z.object({
  batchId: z.string().uuid("Parameter batchId tidak valid."),
  name: z.string().trim().min(3, "Nama batch minimal 3 karakter.").max(200),
  tukName: z.string().trim().max(200).optional(),
  tukType: z.enum(["sewaktu", "tempat_kerja", "mandiri"]),
  assessmentDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal asesmen harus YYYY-MM-DD.")
    .optional()
    .or(z.literal("")),
  schemeId: z.string().uuid("Skema sertifikasi tidak valid.").optional(),
  driveFolderUrl: z.string().trim().max(500).optional(),
  kelompokSheetUrl: z.string().trim().max(500).optional(),
});

export async function updateBatchMetadataAction(formData: FormData): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const parsed = UpdateBatchMetadataSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    tukName: String(formData.get("tukName") ?? "").trim(),
    tukType: String(formData.get("tukType") ?? "sewaktu").trim(),
    assessmentDate: String(formData.get("assessmentDate") ?? "").trim(),
    schemeId: String(formData.get("schemeId") ?? "").trim() || undefined,
    driveFolderUrl: String(formData.get("driveFolderUrl") ?? "").trim(),
    kelompokSheetUrl: String(formData.get("kelompokSheetUrl") ?? "").trim(),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data batch tidak valid.",
    };
  }

  const data = parsed.data;
  if (data.driveFolderUrl) {
    const driveCheck = validateSafeExternalUrl(data.driveFolderUrl, [
      "drive.google.com",
      "docs.google.com",
    ]);
    if (!driveCheck.safe) {
      return { ok: false, error: `Tautan Drive tidak aman/valid: ${driveCheck.reason}` };
    }
  }
  if (data.kelompokSheetUrl) {
    const sheetCheck = validateSafeExternalUrl(data.kelompokSheetUrl, ["docs.google.com"]);
    if (!sheetCheck.safe) {
      return { ok: false, error: `Tautan Google Sheet tidak aman/valid: ${sheetCheck.reason}` };
    }
  }

  const rate = checkRateLimit(`batch:update:${user.id}:${data.batchId}`, 20, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak pembaruan metadata batch. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const batch = await getBatchById(user.id, data.batchId);
  if (!batch) {
    return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };
  }

  const roleCheck = await requireLspRole(batch.lspId, user.id, [
    "lsp_admin",
    "tuk_admin",
    "assessor",
  ]);
  if (!roleCheck.allowed) {
    return {
      ok: false,
      error: "Akses ditolak: Anda tidak berwenang mengubah metadata batch.",
    };
  }

  try {
    await updateBatchMetadata({
      userId: user.id,
      batchId: batch.id,
      name: data.name,
      tukName: data.tukName ? data.tukName : null,
      tukType: data.tukType,
      assessmentDate: data.assessmentDate ? data.assessmentDate : null,
      ...(data.schemeId ? { schemeId: data.schemeId } : {}),
      ...(data.driveFolderUrl !== undefined
        ? { driveFolderUrl: data.driveFolderUrl ? data.driveFolderUrl : null }
        : {}),
      ...(data.kelompokSheetUrl !== undefined
        ? { kelompokSheetUrl: data.kelompokSheetUrl ? data.kelompokSheetUrl : null }
        : {}),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui metadata batch.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "batch.update",
        resource: "batches",
        resource_id: batch.id,
        after_summary: {
          name: data.name,
          tukName: data.tukName || null,
          tukType: data.tukType,
          assessmentDate: data.assessmentDate || null,
          schemeId: data.schemeId ?? batch.schemeId,
        },
      },
      supabase,
    );
  } catch (err) {
    console.warn("[BatchUpdate] audit log failed:", err instanceof Error ? err.message : String(err));
  }

  revalidatePath("/batches");
  revalidatePath(`/batches/${batch.id}`);
  revalidatePath(`/batches/${batch.id}/ak05`);
  revalidatePath("/settings/audit");
  return { ok: true, message: "Metadata batch berhasil diperbarui." };
}

async function readValidatedSuratTugasFile(
  rawFile: FormDataEntryValue | null,
): Promise<
  | { ok: true; fileName: string; mimeType: string; buffer: Buffer; text: string; extractionMethod: string; parsed: ParsedSuratTugasResult }
  | { ok: false; error: string }
> {
  if (!rawFile || typeof rawFile !== "object" || !("arrayBuffer" in rawFile)) {
    return { ok: false, error: "Pilih berkas Surat Tugas (.pdf, .docx, atau .txt)." };
  }
  const file = rawFile as File;
  if (!ALLOWED_SURAT_TUGAS_EXT_RE.test(file.name)) {
    return { ok: false, error: "Format Surat Tugas harus .pdf, .docx, atau .txt." };
  }
  if (file.size <= 0 || file.size > MAX_SURAT_TUGAS_BYTES) {
    return { ok: false, error: "Ukuran berkas Surat Tugas maksimal 10 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractTextFromBuffer({
    buffer,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
  });
  const text = extracted.text.trim();
  if (!text) {
    return {
      ok: false,
      error: "Teks tidak dapat dibaca dari Surat Tugas ini (mungkin PDF scan gambar tanpa teks).",
    };
  }

  return {
    ok: true,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    buffer,
    text,
    extractionMethod: extracted.extractionMethod,
    parsed: parseSuratTugasText(text),
  };
}

export async function parseSuratTugasPreviewAction(formData: FormData): Promise<{
  ok: boolean;
  fileName?: string;
  parsed?: ParsedSuratTugasResult;
  error?: string;
}> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };

  const parsedInput = BatchIdSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
  });
  if (!parsedInput.success) {
    return { ok: false, error: parsedInput.error.issues[0]?.message ?? "Parameter tidak valid." };
  }
  const { batchId } = parsedInput.data;

  const rate = checkRateLimit(`batch:surat_tugas_preview:${user.id}:${batchId}`, 25, 60_000);
  if (!rate.allowed) {
    return { ok: false, error: `Terlalu banyak permintaan pratinjau. Coba lagi dalam ${rate.retryAfterSeconds} detik.` };
  }

  const batch = await getBatchById(user.id, batchId);
  if (!batch) return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };

  const roleCheck = await requireLspRole(batch.lspId, user.id, [
    "lsp_admin",
    "tuk_admin",
    "assessor",
  ]);
  if (!roleCheck.allowed) {
    return { ok: false, error: "Akses ditolak untuk membaca Surat Tugas batch." };
  }

  const fileRes = await readValidatedSuratTugasFile(formData.get("suratTugasFile"));
  if (!fileRes.ok) {
    return { ok: false, error: fileRes.error };
  }

  return {
    ok: true,
    fileName: fileRes.fileName,
    parsed: fileRes.parsed,
  };
}

export async function uploadBatchSuratTugasAction(formData: FormData): Promise<{
  ok: boolean;
  fileName?: string;
  parsed?: ParsedSuratTugasResult;
  importedCandidates?: number;
  message?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };

  const parsedInput = BatchIdSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
  });
  if (!parsedInput.success) {
    return { ok: false, error: parsedInput.error.issues[0]?.message ?? "Parameter tidak valid." };
  }
  const { batchId } = parsedInput.data;

  const rate = checkRateLimit(`batch:surat_tugas:${user.id}:${batchId}`, 15, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak unggahan Surat Tugas. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const batch = await getBatchById(user.id, batchId);
  if (!batch) return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };

  const roleCheck = await requireLspRole(batch.lspId, user.id, [
    "lsp_admin",
    "tuk_admin",
    "assessor",
  ]);
  if (!roleCheck.allowed) {
    return {
      ok: false,
      error: "Akses ditolak: hanya Admin LSP, Admin TUK, atau Asesor yang dapat mengunggah Surat Tugas.",
    };
  }

  const fileRes = await readValidatedSuratTugasFile(formData.get("suratTugasFile"));
  if (!fileRes.ok) {
    return { ok: false, error: fileRes.error };
  }

  const applyMetadata = String(formData.get("applyMetadata") ?? "true") !== "false";
  const importCandidates = String(formData.get("importCandidates") ?? "false") === "true";
  const overrideDate = String(formData.get("assessmentDate") ?? "").trim();
  const overrideTuk = String(formData.get("tukName") ?? "").trim();

  if (overrideDate && !/^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
    return { ok: false, error: "Format tanggal asesmen harus YYYY-MM-DD." };
  }

  const targetDate = overrideDate || fileRes.parsed.assessmentDate;
  const targetTuk = overrideTuk || fileRes.parsed.tukName;

  try {
    await upsertDriveFilesForBatch({
      userId: user.id,
      lspId: batch.lspId,
      batchId: batch.id,
      files: [
        {
          driveFileId: `manual-st-${batch.id}-${Date.now()}`,
          fileName: fileRes.fileName,
          mimeType: fileRes.mimeType,
          drivePath: `Manual Upload/Surat Tugas/${fileRes.fileName}`,
          docType: "surat_tugas",
          confidence: 1,
          assesseeId: null,
          triageStatus: "not_needed",
          triageReason: "Surat Tugas batch diunggah manual (opsional)",
          extractedText: fileRes.text.slice(0, 60_000),
          extractionMethod: fileRes.extractionMethod,
        },
      ],
    });

    if (applyMetadata && (targetDate || targetTuk)) {
      await updateBatchMetadata({
        userId: user.id,
        batchId: batch.id,
        ...(targetDate && (!batch.assessmentDate || Boolean(overrideDate))
          ? { assessmentDate: targetDate }
          : {}),
        ...(targetTuk && (!batch.tukName || Boolean(overrideTuk))
          ? { tukName: targetTuk }
          : {}),
      });
    }

    let importedCount = 0;
    if (importCandidates && fileRes.parsed.candidateNames.length > 0) {
      const existingPool = await listAssesseesByBatch(user.id, batch.id);
      const existingSet = new Set(existingPool.map((a) => a.displayName.trim().toLowerCase()));
      const newNames = fileRes.parsed.candidateNames.filter(
        (n) => !existingSet.has(n.trim().toLowerCase()),
      );
      if (newNames.length > 0) {
        await upsertAssesseesForBatch({
          userId: user.id,
          lspId: batch.lspId,
          batchId: batch.id,
          names: newNames,
          existingPool,
        });
        importedCount = newNames.length;
      }
    }

    try {
      const supabase = await getSupabaseServerClient();
      await writeAuditLog(
        {
          lsp_id: batch.lspId,
          actor_id: user.id,
          action: "batch.surat_tugas.upload",
          resource: "batches",
          resource_id: batch.id,
          after_summary: {
            fileName: fileRes.fileName,
            letterNumber: fileRes.parsed.letterNumber,
            assessmentDate: targetDate ?? null,
            tukName: targetTuk ?? null,
            detectedCandidates: fileRes.parsed.candidateNames.length,
            importedCandidates: importedCount,
          },
        },
        supabase,
      );
    } catch (err) {
      console.warn(
        "[SuratTugasUpload] audit log failed:",
        err instanceof Error ? err.message : String(err),
      );
    }

    revalidatePath("/batches");
    revalidatePath(`/batches/${batch.id}`);
    revalidatePath(`/batches/${batch.id}/triage`);
    revalidatePath(`/batches/${batch.id}/ak05`);
    revalidatePath("/settings/audit");

    return {
      ok: true,
      fileName: fileRes.fileName,
      parsed: fileRes.parsed,
      importedCandidates: importedCount,
      message: `Surat Tugas "${fileRes.fileName}" tersimpan${importedCount > 0 ? ` · ${importedCount} peserta ditambahkan ke roster` : ""}.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan Surat Tugas batch.",
    };
  }
}
