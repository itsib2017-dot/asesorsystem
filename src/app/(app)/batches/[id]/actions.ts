"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/get-session";
import {
  parseMasterKey06bFile,
  persistBatchMasterKey06b,
} from "@/lib/written/master-key";
import { getBatchById } from "@/repositories/batches.repository";

export async function uploadBatchMasterKey06bAction(formData: FormData): Promise<{
  ok: boolean;
  fileName?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  const uploadedFile = formData.get("masterKeyFile");
  if (!batchId) {
    return { ok: false, error: "Parameter batchId wajib diisi." };
  }
  if (!uploadedFile || typeof uploadedFile !== "object" || !("arrayBuffer" in uploadedFile)) {
    return { ok: false, error: "Pilih berkas FR.IA.06B (.docx atau .txt)." };
  }

  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };
  }

  const parsed = await parseMasterKey06bFile(uploadedFile as File);
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
  });

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/triage`);
  return { ok: true, fileName: parsed.fileName };
}
