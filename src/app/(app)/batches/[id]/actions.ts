"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { requireLspRole } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { decryptAgileOoxmlBuffer } from "@/lib/written/ooxml-decrypt";
import {
  classifyMasterKeyOrigin,
  parseMasterKey06bFile,
  persistBatchMasterKey06b,
  validateMasterKey06bContent,
} from "@/lib/written/master-key";
import {
  clearBatchActiveMasterKey,
  getBatchById,
  getDriveFileById,
  setBatchActiveMasterKey,
  updateDriveFileExtraction,
  updateDriveFileTriage,
  type DriveFileRecord,
} from "@/repositories/batches.repository";
import { downloadPublicDriveFileBuffer } from "@/services/drive-extract";
import {
  extractTextFromBuffer,
  extractTextFromDocx,
  isOleEncryptedBuffer,
} from "@/services/extract";

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
