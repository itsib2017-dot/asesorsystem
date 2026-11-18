"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getUser } from "@/lib/auth/get-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseMasterKey06bFile,
  persistBatchMasterKey06b,
} from "@/lib/written/master-key";
import {
  getBatchById,
  listDriveFilesForBatch,
} from "@/repositories/batches.repository";
import { enqueueJob } from "@/worker/queue";

const WrittenGradingInputSchema = z.object({
  batchId: z.string().trim().min(1, "Parameter batchId wajib diisi."),
  assesseeId: z.string().trim().min(1, "Parameter assesseeId wajib diisi."),
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
    batchId: String(formData.get("batchId") ?? ""),
    assesseeId: String(formData.get("assesseeId") ?? ""),
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

  const files = await listDriveFilesForBatch(user.id, batch.id);
  const existing06c = files.find(
    (f) => f.assesseeId === assesseeId && f.docType.toLowerCase() === "06c",
  );
  const stored06cText = (existing06c?.extractedText ?? "").trim();
  const manualAnswerEdited =
    Boolean(inputStudentAnswerText) && inputStudentAnswerText !== stored06cText;

  let resolvedMasterKeyText = inputMasterKeyText;
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
    resolvedMasterKeyText = parsed.text;
    await persistBatchMasterKey06b({
      userId: user.id,
      lspId: batch.lspId,
      batchId: batch.id,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      text: parsed.text,
      extractionMethod: parsed.extractionMethod,
      assesseeId,
      hasUploadedFile: true,
      usedRuntimePassword: Boolean(runtimePassword),
    });
  } else if (resolvedMasterKeyText) {
    const has06b = files.some((f) => f.docType.toLowerCase() === "06b");
    if (!has06b) {
      await persistBatchMasterKey06b({
        userId: user.id,
        lspId: batch.lspId,
        batchId: batch.id,
        fileName: "FR.IA.06B_Kunci_Manual.txt",
        mimeType: "text/plain",
        text: resolvedMasterKeyText,
        extractionMethod: "raw_text",
        assesseeId,
        hasUploadedFile: false,
      });
    }
  }

  const jobRes = await enqueueJob({
    userId: user.id,
    type: "written_grading",
    payload: {
      assesseeId,
      ...(resolvedMasterKeyText ? { masterKeyText: resolvedMasterKeyText } : {}),
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

  revalidatePath(`/batches/${batchId}/assessees/${assesseeId}/written`);
  revalidatePath(`/batches/${batchId}/assessees/${assesseeId}`);

  return {
    ok: true,
    jobId: jobRes.job.id,
    message: "Kunci 06B tersimpan dan penilaian tertulis FR.IA.06 selesai dijalankan.",
  };
}
