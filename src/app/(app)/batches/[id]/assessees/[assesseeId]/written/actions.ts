"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/get-session";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getBatchById,
  listDriveFilesForBatch,
  upsertDriveFilesForBatch,
} from "@/repositories/batches.repository";
import { extractTextFromDocx } from "@/services/extract";
import { enqueueJob } from "@/worker/queue";

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

  const batchId = String(formData.get("batchId") ?? "").trim();
  const assesseeId = String(formData.get("assesseeId") ?? "").trim();
  const inputMasterKeyText = String(formData.get("masterKeyText") ?? "").trim();
  const inputStudentAnswerText = String(formData.get("studentAnswerText") ?? "").trim();
  const uploadedFile = formData.get("masterKeyFile");

  if (!batchId || !assesseeId) {
    return { ok: false, error: "Parameter batchId dan assesseeId wajib diisi." };
  }

  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };
  }

  let resolvedMasterKeyText = inputMasterKeyText;

  if (uploadedFile && typeof uploadedFile === "object" && "arrayBuffer" in uploadedFile) {
    const fileObj = uploadedFile as File;
    if (fileObj.size > 0) {
      if (fileObj.size > 10 * 1024 * 1024) {
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
        const buffer = Buffer.from(await fileObj.arrayBuffer());
        if (fileNameLower.endsWith(".txt")) {
          resolvedMasterKeyText = buffer.toString("utf8").trim();
        } else {
          const parsed = await extractTextFromDocx(buffer);
          resolvedMasterKeyText = parsed.text;
        }
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "Gagal membaca berkas kunci 06B.",
        };
      }

      if (!resolvedMasterKeyText) {
        return {
          ok: false,
          error: "Teks kunci jawaban 06B tidak ditemukan di dalam berkas.",
        };
      }

      await upsertDriveFilesForBatch({
        userId: user.id,
        lspId: batch.lspId,
        batchId: batch.id,
        files: [
          {
            driveFileId: `manual-06b-${batch.id}`,
            fileName: fileObj.name,
            mimeType:
              fileObj.type ||
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            drivePath: `Manual Upload/${fileObj.name}`,
            docType: "06b",
            confidence: 1,
            assesseeId: null,
            triageStatus: "assigned",
            extractedText: resolvedMasterKeyText,
            extractionMethod: fileNameLower.endsWith(".txt") ? "raw_text" : "ooxml_docx",
          },
        ],
      });
    }
  } else if (resolvedMasterKeyText) {
    // Also persist text override to shared 06B slot if no 06B file exists yet
    const files = await listDriveFilesForBatch(user.id, batch.id);
    const has06b = files.some((f) => f.docType.toLowerCase() === "06b");
    if (!has06b) {
      await upsertDriveFilesForBatch({
        userId: user.id,
        lspId: batch.lspId,
        batchId: batch.id,
        files: [
          {
            driveFileId: `manual-06b-${batch.id}`,
            fileName: "FR.IA.06B_Kunci_Manual.txt",
            mimeType: "text/plain",
            drivePath: "Manual Upload/FR.IA.06B_Kunci_Manual.txt",
            docType: "06b",
            confidence: 1,
            assesseeId: null,
            triageStatus: "assigned",
            extractedText: resolvedMasterKeyText,
            extractionMethod: "raw_text",
          },
        ],
      });
    }
  }

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "written.key_06b.upload",
        resource: "batches",
        resource_id: batch.id,
        after_summary: {
          assesseeId,
          hasUploadedFile: Boolean(
            uploadedFile && typeof uploadedFile === "object" && "size" in uploadedFile && (uploadedFile as File).size > 0,
          ),
          masterKeyChars: resolvedMasterKeyText.length,
        },
      },
      supabase,
    );
  } catch {
    // non-fatal audit log failure
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
