"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/get-session";
import { updateDriveFileTriage } from "@/repositories/batches.repository";

export async function assignDriveFileAction(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const batchId = String(formData.get("batchId") ?? "");
  const fileId = String(formData.get("fileId") ?? "");
  const assesseeId = String(formData.get("assesseeId") ?? "") || null;
  const docType = String(formData.get("docType") ?? "");
  const status = String(formData.get("triageStatus") ?? "assigned") as
    | "assigned"
    | "not_needed"
    | "unmatched";

  await updateDriveFileTriage({
    userId: user.id,
    fileId,
    assesseeId,
    ...(docType ? { docType } : {}),
    triageStatus: status,
  });

  revalidatePath(`/batches/${batchId}/triage`);
  revalidatePath(`/batches/${batchId}`);
}
