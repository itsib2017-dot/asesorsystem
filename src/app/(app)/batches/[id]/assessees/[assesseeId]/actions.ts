"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth/get-session";
import { requireLspRole } from "@/lib/auth/get-role";
import { confirmCertificateName, getAssesseeById } from "@/repositories/assessees.repository";
import { getBatchById } from "@/repositories/batches.repository";
import {
  upsertAssesseeDecisionOverride,
  upsertUnitDecision,
} from "@/repositories/assessment.repository";
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

  const roleCheck = await requireLspRole(batch.lspId, user.id, ["lsp_admin", "assessor"]);
  if (!roleCheck.allowed) {
    return {
      ok: false,
      error: "Forbidden: Hanya Asesor atau LSP Admin yang berwenang menetapkan keputusan unit.",
    };
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
  revalidatePath(`/settings/audit`);
  return { ok: true };
}

const overallOverrideSchema = z.object({
  batchId: z.string().uuid(),
  assesseeId: z.string().uuid(),
  overrideDecision: z.enum(["K", "BK", "AUTO"]),
  overrideReason: z.string().max(1000).default(""),
});

export async function saveOverallDecisionOverrideAction(formData: FormData): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const parsed = overallOverrideSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    assesseeId: String(formData.get("assesseeId") ?? "").trim(),
    overrideDecision: String(formData.get("overrideDecision") ?? "").trim(),
    overrideReason: String(formData.get("overrideReason") ?? "").trim(),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Parameter override keputusan tidak valid.",
    };
  }

  const { batchId, assesseeId, overrideDecision, overrideReason } = parsed.data;
  if ((overrideDecision === "K" || overrideDecision === "BK") && overrideReason.trim().length < 5) {
    return {
      ok: false,
      error: "Alasan override manual (minimal 5 karakter) wajib diisi sebagai dasar audit.",
    };
  }

  const [batch, assessee] = await Promise.all([
    getBatchById(user.id, batchId),
    getAssesseeById(user.id, assesseeId),
  ]);
  if (!batch || !assessee || assessee.batchId !== batch.id) {
    return { ok: false, error: "Asesi atau batch tidak ditemukan atau akses ditolak." };
  }

  const roleCheck = await requireLspRole(batch.lspId, user.id, ["lsp_admin", "assessor"]);
  if (!roleCheck.allowed) {
    return {
      ok: false,
      error: "Forbidden: Hanya Asesor atau LSP Admin yang berwenang menetapkan override keputusan akhir.",
    };
  }

  const normalizedDecision = overrideDecision === "AUTO" ? null : overrideDecision;
  const saved = await upsertAssesseeDecisionOverride({
    userId: user.id,
    lspId: batch.lspId,
    batchId,
    assesseeId,
    overrideDecision: normalizedDecision,
    overrideReason:
      normalizedDecision === null
        ? overrideReason.trim() || "Dikembalikan ke roll-up otomatis"
        : overrideReason.trim(),
  });

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action:
          normalizedDecision === null
            ? "assessee.decision_override.cleared"
            : "assessee.decision_override.saved",
        resource: "assessees",
        resource_id: assesseeId,
        after_summary: {
          batchId,
          overrideDecision: normalizedDecision ?? "AUTO",
          overrideReason: saved.overrideReason,
          version: saved.version,
        },
      },
      supabase,
    );
  } catch (err) {
    console.warn(
      "[OverallDecisionOverride Audit Warning]:",
      err instanceof Error ? err.message : "unknown",
    );
  }

  revalidatePath(`/batches/${batchId}/assessees/${assesseeId}`);
  revalidatePath(`/batches/${batchId}/assessees/${assesseeId}/dit`);
  revalidatePath(`/batches/${batchId}/ak05`);
  revalidatePath(`/settings/audit`);

  return {
    ok: true,
    message:
      normalizedDecision === null
        ? "Override manual dihapus — keputusan akhir AK.02 & AK.05 mengikuti roll-up otomatis."
        : `Keputusan akhir manual (${normalizedDecision}) berhasil ditetapkan untuk FR.AK.02 & FR.AK.05.`,
  };
}
