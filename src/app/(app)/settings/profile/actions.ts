"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/get-session";
import { uploadAssessorSignature } from "@/repositories/signatures.repository";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2 MB

export async function uploadSignatureAction(formData: FormData) {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan login terlebih dahulu." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Berkas tanda tangan tidak valid." };
  }

  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    return {
      ok: false,
      error: "Format berkas tidak didukung. Gunakan PNG atau JPG saja.",
    };
  }

  if (file.size === 0 || file.size > MAX_SIGNATURE_BYTES) {
    return {
      ok: false,
      error: "Ukuran berkas tanda tangan harus antara 1 byte hingga 2 MB.",
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const res = await uploadAssessorSignature({
    assessorId: user.id,
    buffer,
    mimeType: file.type,
  });

  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  revalidatePath("/batches");

  return { ok: true };
}
