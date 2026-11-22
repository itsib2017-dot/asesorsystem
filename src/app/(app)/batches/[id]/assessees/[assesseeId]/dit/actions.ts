"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { requireLspRole } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAssesseeById } from "@/repositories/assessees.repository";
import { saveOfficial04bAssessment } from "@/repositories/assessment.repository";
import { getBatchById } from "@/repositories/batches.repository";

const ia04bItemSchema = z.object({
  kpIndex: z.number().int().min(1).max(50),
  no: z.number().int().min(1).max(200),
  unitCode: z.string().max(64).default(""),
  achieved: z.boolean().nullable(),
  note: z.string().max(1000).optional(),
});

const saveIa04bSchema = z.object({
  batchId: z.string().uuid(),
  assesseeId: z.string().uuid(),
  items: z.array(ia04bItemSchema).min(1),
  overallRecommendation: z.enum(["K", "BK"]).nullable(),
  assessorNotes: z.string().max(4000).default(""),
});

export async function saveIa04bAssessmentAction(formData: FormData): Promise<{
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
    return { ok: false, error: "Format data penilaian FR.IA.04B tidak valid." };
  }

  const rawOverall = String(formData.get("overallRecommendation") ?? "").trim();
  const parsed = saveIa04bSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    assesseeId: String(formData.get("assesseeId") ?? "").trim(),
    items: parsedItems,
    overallRecommendation: rawOverall === "K" || rawOverall === "BK" ? rawOverall : null,
    assessorNotes: String(formData.get("assessorNotes") ?? "").trim(),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data penilaian FR.IA.04B tidak valid.",
    };
  }

  const data = parsed.data;
  if (data.overallRecommendation === "BK" && !data.assessorNotes) {
    return {
      ok: false,
      error: "Catatan asesor wajib diisi apabila rekomendasi FR.IA.04B adalah BK.",
    };
  }

  const rate = checkRateLimit(`ia04b:save:${user.id}:${data.assesseeId}`, 30, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak permintaan penyimpanan FR.IA.04B. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
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
    return { ok: false, error: "Akses ditolak: hanya Asesor atau Admin LSP yang berwenang mengisi FR.IA.04B." };
  }

  try {
    await saveOfficial04bAssessment({
      userId: user.id,
      lspId: batch.lspId,
      batchId: batch.id,
      assesseeId: assessee.id,
      official04b: {
        items: data.items,
        overallRecommendation: data.overallRecommendation,
        assessorNotes: data.assessorNotes,
        assessedBy: user.id,
        assessedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan penilaian FR.IA.04B.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "dit.ia04b.save",
        resource: "assessees",
        resource_id: assessee.id,
        after_summary: {
          batchId: batch.id,
          itemCount: data.items.length,
          yaCount: data.items.filter((i) => i.achieved === true).length,
          tidakCount: data.items.filter((i) => i.achieved === false).length,
          overallRecommendation: data.overallRecommendation,
        },
      },
      supabase,
    );
  } catch {
    // non-fatal audit error
  }

  revalidatePath(`/batches/${batch.id}/assessees/${assessee.id}`);
  revalidatePath(`/batches/${batch.id}/assessees/${assessee.id}/dit`);
  revalidatePath(`/batches/${batch.id}/ak05`);
  revalidatePath("/settings/audit");

  return {
    ok: true,
    message: `Penilaian formulir FR.IA.04B (${data.items.filter((i) => i.achieved === true).length} Ya · ${data.items.filter((i) => i.achieved === false).length} Tidak) tersimpan.`,
  };
}
