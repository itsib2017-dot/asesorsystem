"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { requireLspRole } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseMasterKey06bFile,
  persistBatchMasterKey06b,
  resolveBatchActiveMasterKey,
  validateMasterKey06bContent,
} from "@/lib/written/master-key";
import {
  getBatchById,
  listDriveFilesForBatch,
} from "@/repositories/batches.repository";
import { pickLatestDriveFile } from "@/services/drive-revisions";
import { enqueueJob } from "@/worker/queue";

const WrittenGradingInputSchema = z.object({
  batchId: z.string().uuid("Parameter batchId tidak valid."),
  assesseeId: z.string().uuid("Parameter assesseeId tidak valid."),
});

export async function runWrittenGradingWithKeyAction(formData: FormData): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
  jobId?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const parsedInput = WrittenGradingInputSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    assesseeId: String(formData.get("assesseeId") ?? "").trim(),
  });
  if (!parsedInput.success) {
    return {
      ok: false,
      error: parsedInput.error.issues[0]?.message ?? "Parameter batchId dan assesseeId wajib diisi.",
    };
  }
  const { batchId, assesseeId } = parsedInput.data;

  const inputMasterKeyText = String(formData.get("masterKeyText") ?? "").trim();
  const inputStudentAnswerText = String(formData.get("studentAnswerText") ?? "").trim();
  const uploadedFile = formData.get("masterKeyFile");
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
      error: "Akses ditolak: hanya Asesor atau Admin LSP yang dapat menjalankan koreksi tertulis.",
    };
  }

  const files = await listDriveFilesForBatch(user.id, batch.id);
  const existing06c = pickLatestDriveFile(
    files.filter((f) => f.assesseeId === assesseeId && f.docType.toLowerCase() === "06c"),
  );
  const stored06cText = (existing06c?.extractedText ?? "").trim();
  const manualAnswerEdited =
    Boolean(inputStudentAnswerText) && inputStudentAnswerText !== stored06cText;

  const resolvedBatchKey = resolveBatchActiveMasterKey(batch, files);
  let resolvedMasterKeyText = "";
  const hasUploadedFile = Boolean(
    uploadedFile &&
      typeof uploadedFile === "object" &&
      "arrayBuffer" in uploadedFile &&
      (uploadedFile as File).size > 0,
  );

  if (hasUploadedFile) {
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
      assesseeId,
      hasUploadedFile: true,
      source: "assessor_upload",
      usedRuntimePassword: Boolean(runtimePassword),
    });
    if (!persisted.ok) {
      return { ok: false, error: persisted.error };
    }
    resolvedMasterKeyText = parsed.text;
  } else if (inputMasterKeyText) {
    const validation = validateMasterKey06bContent(inputMasterKeyText);
    if (!validation.valid) {
      return {
        ok: false,
        error: `Teks kunci 06B ditolak: ${validation.summary}`,
      };
    }
    resolvedMasterKeyText = inputMasterKeyText;
    if (!resolvedBatchKey.activeFile || !resolvedBatchKey.isReadyForGrading) {
      const persisted = await persistBatchMasterKey06b({
        userId: user.id,
        lspId: batch.lspId,
        batchId: batch.id,
        fileName: "FR.IA.06B_Kunci_Manual.txt",
        mimeType: "text/plain",
        text: resolvedMasterKeyText,
        extractionMethod: "raw_text",
        assesseeId,
        hasUploadedFile: false,
        source: "manual_text",
      });
      if (!persisted.ok) {
        return { ok: false, error: persisted.error };
      }
    }
  } else {
    if (!resolvedBatchKey.isReadyForGrading || !resolvedBatchKey.activeFile?.extractedText) {
      return {
        ok: false,
        error:
          resolvedBatchKey.blockingWarning ??
          "Koreksi tertulis diblokir: belum ada kunci 06B aktif yang lolos validasi isi di batch ini.",
      };
    }
    resolvedMasterKeyText = resolvedBatchKey.activeFile.extractedText.trim();
  }

  const finalCheck = validateMasterKey06bContent(resolvedMasterKeyText);
  if (!finalCheck.valid) {
    return {
      ok: false,
      error: `Koreksi tertulis diblokir: ${finalCheck.summary}`,
    };
  }

  const jobRes = await enqueueJob({
    userId: user.id,
    lspId: batch.lspId,
    type: "written_grading",
    payload: {
      batchId,
      assesseeId,
      masterKeyText: resolvedMasterKeyText,
      ...(inputStudentAnswerText ? { studentAnswerText: inputStudentAnswerText } : {}),
    },
  });

  if (!jobRes.ok) {
    return { ok: false, error: jobRes.error };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "written.grading.run",
        resource: "assessees",
        resource_id: assesseeId,
        after_summary: {
          batchId,
          jobId: jobRes.job.id,
          jobStatus: jobRes.job.status,
          hasUploadedKeyFile: hasUploadedFile,
          usedRuntimePassword: Boolean(runtimePassword),
          manualAnswerEdited,
          stored06cChars: stored06cText.length,
          submittedAnswerChars: inputStudentAnswerText.length,
        },
      },
      supabase,
    );
  } catch (err) {
    console.warn("[WrittenGradingAction] audit log failed:", err instanceof Error ? err.message : String(err));
  }

  if (jobRes.job.status === "failed") {
    return {
      ok: false,
      jobId: jobRes.job.id,
      error: jobRes.job.error || "Koreksi tertulis gagal dijalankan.",
    };
  }

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/assessees/${assesseeId}/written`);
  revalidatePath(`/batches/${batchId}/assessees/${assesseeId}`);

  return {
    ok: true,
    jobId: jobRes.job.id,
    message: "Kunci 06B tersimpan dan penilaian tertulis FR.IA.06 selesai dijalankan.",
  };
}
