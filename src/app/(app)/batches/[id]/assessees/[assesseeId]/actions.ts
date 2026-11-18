"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/get-session";
import { confirmCertificateName, getAssesseeById } from "@/repositories/assessees.repository";
import { getBatchById } from "@/repositories/batches.repository";
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

  const assessee = await getAssesseeById(user.id, assesseeId);
  if (!assessee) {
    return { ok: false, message: "Asesi tidak ditemukan atau akses ditolak." };
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
      lsp_id: assessee.lspId,
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

  const assesseeId = String(formData.get("assesseeId") ?? "").trim();
  const batchId = String(formData.get("batchId") ?? "").trim();
  const unitCode = String(formData.get("unitCode") ?? "").trim();
  const unitTitle = String(formData.get("unitTitle") ?? "").trim();
  const decision = String(formData.get("decision") ?? "") as "K" | "BK";
  const assessorNote = String(formData.get("assessorNote") ?? "").trim();
  const aiRecRaw = String(formData.get("aiRecommendation") ?? "").trim();
  const aiRecommendation = aiRecRaw === "K" || aiRecRaw === "BK" ? aiRecRaw : undefined;
  const vatmReasoning = String(formData.get("vatmReasoning") ?? "").trim() || undefined;

  if (!assesseeId || !batchId || !unitCode) {
    return { ok: false, error: "Parameter unit kompetensi tidak lengkap." };
  }
  if (decision !== "K" && decision !== "BK") {
    return { ok: false, error: "Keputusan hanya boleh K atau BK." };
  }
  if (decision === "BK" && !assessorNote) {
    return { ok: false, error: "Catatan wajib diisi untuk keputusan BK." };
  }

  const [batch, assessee] = await Promise.all([
    getBatchById(user.id, batchId),
    getAssesseeById(user.id, assesseeId),
  ]);
  if (!batch || !assessee || assessee.batchId !== batch.id) {
    return { ok: false, error: "Asesi atau batch tidak ditemukan." };
  }

  await upsertUnitDecision({
    userId: user.id,
    lspId: batch.lspId,
    batchId,
    assesseeId,
    unitCode,
    unitTitle,
    aiRecommendation,
    vatmReasoning,
    decision,
    assessorNote,
  });

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "decision.unit.save",
        resource: "assessees",
        resource_id: assesseeId,
        after_summary: { batchId, unitCode, decision },
      },
      supabase,
    );
  } catch {
    // non-fatal audit error
  }

  revalidatePath(`/batches/${batchId}/assessees/${assesseeId}`);
  revalidatePath(`/batches/${batchId}/ak05`);
  return { ok: true };
}
