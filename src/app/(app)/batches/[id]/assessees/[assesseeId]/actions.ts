"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/get-session";
import { confirmCertificateName } from "@/repositories/assessees.repository";
import { upsertUnitDecision } from "@/repositories/assessment.repository";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function confirmCertificateNameAction(formData: FormData) {
  const user = await getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

  const assesseeId = String(formData.get("assesseeId") ?? "");
  const confirmedName = String(formData.get("confirmedName") ?? "").trim();
  const overrideReason = String(formData.get("overrideReason") ?? "").trim() || undefined;

  if (!assesseeId || !confirmedName) {
    return { ok: false, message: "Nama sertifikat tidak boleh kosong." };
  }

  await confirmCertificateName({
    userId: user.id,
    assesseeId,
    confirmedName,
    overrideReason,
  });

  const supabase = await getSupabaseServerClient();
  await writeAuditLog(
    {
      actor_id: user.id,
      action: overrideReason ? "identity.name.override" : "identity.name.confirm",
      resource: "assessees",
      resource_id: assesseeId,
      after_summary: { confirmedName, overrideReason },
    },
    supabase,
  );

  revalidatePath(`/batches`);
  return { ok: true, message: `Nama sertifikat dikonfirmasi: ${confirmedName}` };
}

export async function saveUnitDecisionAction(formData: FormData) {
  const user = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const assesseeId = String(formData.get("assesseeId") ?? "");
  const batchId = String(formData.get("batchId") ?? "");
  const unitCode = String(formData.get("unitCode") ?? "");
  const unitTitle = String(formData.get("unitTitle") ?? "");
  const decision = String(formData.get("decision") ?? "") as "K" | "BK";
  const assessorNote = String(formData.get("assessorNote") ?? "").trim();

  if (decision !== "K" && decision !== "BK") {
    return { ok: false, error: "Keputusan hanya boleh K atau BK." };
  }
  if (decision === "BK" && !assessorNote) {
    return { ok: false, error: "Catatan wajib diisi untuk keputusan BK." };
  }

  await upsertUnitDecision({
    userId: user.id,
    lspId: String(formData.get("lspId") ?? batchId),
    batchId,
    assesseeId,
    unitCode,
    unitTitle,
    decision,
    assessorNote,
  });

  revalidatePath(`/batches/${batchId}/assessees/${assesseeId}`);
  return { ok: true };
}
