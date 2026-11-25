"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { requireLspRole } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseMasterKey06bFile,
  persistBatchMasterKey06b,
  resolveBatchActiveMasterKey,
  validateMasterKey06bContent,
} from "@/lib/written/master-key";
import { getAssesseeById } from "@/repositories/assessees.repository";
import { saveOfficial06cAssessment } from "@/repositories/assessment.repository";
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

const ia06cItemSchema = z.object({
  questionNo: z.number().int().min(1).max(200),
  answerText: z.string().max(4000).default(""),
  achieved: z.boolean().nullable(),
  note: z.string().max(1000).optional(),
});

const saveIa06cSchema = z.object({
  batchId: z.string().uuid("Parameter batchId tidak valid."),
  assesseeId: z.string().uuid("Parameter assesseeId tidak valid."),
  items: z.array(ia06cItemSchema).min(1),
  overallAchieved: z.boolean().nullable(),
  feedbackDetail: z.string().max(4000).default(""),
});

export async function saveIa06cAssessmentAction(formData: FormData): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  let parsedItems: unknown = [];
  try {
    parsedItems = JSON.parse(String(formData.get("itemsJson") ?? "[]"));
  } catch {
    return { ok: false, error: "Format data penilaian FR.IA.06C tidak valid." };
  }

  const rawOverall = String(formData.get("overallAchieved") ?? "").trim();
  const overallAchieved =
    rawOverall === "true" || rawOverall === "K"
      ? true
      : rawOverall === "false" || rawOverall === "BK"
        ? false
        : null;

  const parsed = saveIa06cSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    assesseeId: String(formData.get("assesseeId") ?? "").trim(),
    items: parsedItems,
    overallAchieved,
    feedbackDetail: String(formData.get("feedbackDetail") ?? "").trim(),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data penilaian FR.IA.06C tidak valid.",
    };
  }

  const data = parsed.data;
  if (data.overallAchieved === false && !data.feedbackDetail) {
    return {
      ok: false,
      error: "Catatan umpan balik wajib diisi apabila hasil FR.IA.06C adalah Belum Tercapai (BK).",
    };
  }

  const rate = checkRateLimit(`ia06c:save:${user.id}:${data.assesseeId}`, 30, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak permintaan penyimpanan FR.IA.06C. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const [batch, assessee] = await Promise.all([
    getBatchById(user.id, data.batchId),
    getAssesseeById(user.id, data.assesseeId),
  ]);
  if (!batch || !assessee || assessee.batchId !== batch.id) {
    return { ok: false, error: "Batch atau asesi tidak ditemukan." };
  }

  const authz = await requireLspRole(batch.lspId, user.id, ["lsp_admin", "assessor"]);
  if (!authz.allowed) {
    return {
      ok: false,
      error: "Akses ditolak: hanya Asesor atau Admin LSP yang berwenang mengisi FR.IA.06C.",
    };
  }

  try {
    await saveOfficial06cAssessment({
      userId: user.id,
      lspId: batch.lspId,
      batchId: batch.id,
      assesseeId: assessee.id,
      official06c: {
        items: data.items,
        overallAchieved: data.overallAchieved,
        feedbackDetail: data.feedbackDetail,
        assessedBy: user.id,
        assessedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan penilaian FR.IA.06C.",
    };
  }

  const yaCount = data.items.filter((i) => i.achieved === true).length;
  const tidakCount = data.items.filter((i) => i.achieved === false).length;
  const belumCount = data.items.filter((i) => i.achieved === null).length;

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "written.ia06c.save",
        resource: "assessees",
        resource_id: assessee.id,
        after_summary: {
          batchId: batch.id,
          itemCount: data.items.length,
          yaCount,
          tidakCount,
          belumCount,
          overallAchieved: data.overallAchieved,
        },
      },
      supabase,
    );
  } catch (err) {
    console.warn(
      "[SaveIa06cAction] audit log failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  revalidatePath(`/batches/${batch.id}/assessees/${assessee.id}`);
  revalidatePath(`/batches/${batch.id}/assessees/${assessee.id}/written`);
  revalidatePath(`/batches/${batch.id}/ak05`);
  revalidatePath("/settings/audit");

  return {
    ok: true,
    message: `Penilaian formulir FR.IA.06C (${yaCount} Ya · ${tidakCount} Tidak) tersimpan.`,
  };
}
