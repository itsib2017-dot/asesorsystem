"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth/get-session";
import {
  parseMasterKey06bFile,
  persistBatchMasterKey06b,
} from "@/lib/written/master-key";
import { getBatchById } from "@/repositories/batches.repository";

const UploadBatchKeySchema = z.object({
  batchId: z.string().trim().min(1, "Parameter batchId wajib diisi."),
});

export async function uploadBatchMasterKey06bAction(formData: FormData): Promise<{
  ok: boolean;
  fileName?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const parsedInput = UploadBatchKeySchema.safeParse({
    batchId: String(formData.get("batchId") ?? ""),
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

  const parsed = await parseMasterKey06bFile(uploadedFile as File, runtimePassword);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  await persistBatchMasterKey06b({
    userId: user.id,
    lspId: batch.lspId,
    batchId: batch.id,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    text: parsed.text,
    extractionMethod: parsed.extractionMethod,
    hasUploadedFile: true,
    auditAction: "batch.key_06b.upload",
    usedRuntimePassword: Boolean(runtimePassword),
  });

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/triage`);
  return { ok: true, fileName: parsed.fileName };
}
