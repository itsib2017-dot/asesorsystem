"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isUuid } from "@/db";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { resolveAuthorizedLsp } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { syncAssesseeVatmRecommendations } from "@/lib/forms/sync-vatm-decisions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAssesseeById } from "@/repositories/assessees.repository";
import {
  saveInterviewAssessment,
  upsertUnitDecision,
} from "@/repositories/assessment.repository";
import { getBatchById } from "@/repositories/batches.repository";
import { listSchemes } from "@/repositories/schemes.repository";

const questionSchema = z.object({
  no: z.number().int().min(1),
  question: z.string().min(1).max(2000),
  answerSummary: z.string().max(4000).default(""),
  achieved: z.enum(["Ya", "Tidak"]).nullable().default(null),
  unitCode: z.string().max(64).optional(),
});

const unitRecSchema = z.object({
  unitCode: z.string().min(1).max(64),
  unitTitle: z.string().min(1).max(500),
  recommendation: z.enum(["K", "BK"]),
  reasoning: z.string().max(2000).default(""),
});

const saveInterviewSchema = z.object({
  batchId: z.string().uuid(),
  assesseeId: z.string().uuid(),
  sourceFileId: z.string().uuid().optional().nullable(),
  overallRecommendation: z.enum(["K", "BK"]),
  assessorNotes: z.string().max(4000).default(""),
  applyToUnitDecisions: z.boolean().default(false),
  questions: z.array(questionSchema).min(1),
  vatmUnitRecommendations: z.array(unitRecSchema).min(1),
});

export async function saveInterviewAssessmentAction(formData: FormData): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  let parsedQuestions: unknown = [];
  let parsedUnits: unknown = [];
  try {
    parsedQuestions = JSON.parse(String(formData.get("questionsJson") ?? "[]"));
    parsedUnits = JSON.parse(String(formData.get("unitsJson") ?? "[]"));
  } catch {
    return { ok: false, error: "Format JSON pertanyaan atau unit wawancara tidak valid." };
  }

  const rawSourceFileId = String(formData.get("sourceFileId") ?? "").trim();
  const parsed = saveInterviewSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    assesseeId: String(formData.get("assesseeId") ?? "").trim(),
    sourceFileId: rawSourceFileId && isUuid(rawSourceFileId) ? rawSourceFileId : null,
    overallRecommendation: String(formData.get("overallRecommendation") ?? "K").trim(),
    assessorNotes: String(formData.get("assessorNotes") ?? "").trim(),
    applyToUnitDecisions: formData.get("applyToUnitDecisions") === "true",
    questions: parsedQuestions,
    vatmUnitRecommendations: parsedUnits,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data penilaian wawancara tidak valid.",
    };
  }

  const data = parsed.data;
  if (data.overallRecommendation === "BK" && !data.assessorNotes.trim()) {
    return {
      ok: false,
      error: "Catatan asesor wajib diisi apabila rekomendasi wawancara adalah BK.",
    };
  }

  const [batch, assessee, authz] = await Promise.all([
    getBatchById(user.id, data.batchId),
    getAssesseeById(user.id, data.assesseeId),
    resolveAuthorizedLsp(user.id, ["lsp_admin", "assessor"]),
  ]);

  if (!batch || !assessee || assessee.batchId !== batch.id) {
    return { ok: false, error: "Batch atau asesi tidak ditemukan." };
  }
  if (!authz.allowed) {
    return { ok: false, error: "Peran Anda tidak berwenang menyimpan penilaian wawancara." };
  }

  await saveInterviewAssessment({
    userId: user.id,
    lspId: batch.lspId,
    batchId: batch.id,
    assesseeId: assessee.id,
    sourceFileId: data.sourceFileId,
    questions: data.questions,
    overallRecommendation: data.overallRecommendation,
    vatmUnitRecommendations: data.vatmUnitRecommendations,
    assessorNotes: data.assessorNotes,
  });

  const schemes = await listSchemes(user.id, batch.lspId);
  const scheme = schemes.find((s) => s.id === batch.schemeId) ?? null;

  const rollup = await syncAssesseeVatmRecommendations({
    userId: user.id,
    lspId: batch.lspId,
    batchId: batch.id,
    assesseeId: assessee.id,
    scheme,
  });

  if (data.applyToUnitDecisions) {
    const rollupMap = new Map(rollup.map((r) => [r.unitCode, r]));
    await Promise.all(
      data.vatmUnitRecommendations.map((u) => {
        const r = rollupMap.get(u.unitCode);
        return upsertUnitDecision({
          userId: user.id,
          lspId: batch.lspId,
          batchId: batch.id,
          assesseeId: assessee.id,
          unitCode: u.unitCode,
          unitTitle: u.unitTitle,
          aiRecommendation: r?.aiRecommendation ?? u.recommendation,
          vatmReasoning: r?.vatmReasoning ?? u.reasoning,
          decision: u.recommendation,
          assessorNote:
            u.recommendation === "BK"
              ? u.reasoning || data.assessorNotes
              : data.assessorNotes || undefined,
        });
      }),
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "interview.ia09.save",
        resource: "assessees",
        resource_id: assessee.id,
        after_summary: {
          batchId: batch.id,
          overallRecommendation: data.overallRecommendation,
          questionCount: data.questions.length,
          appliedToDecisions: data.applyToUnitDecisions,
        },
      },
      supabase,
    );
  } catch {
    // non-fatal audit error
  }

  revalidatePath(`/batches/${batch.id}/assessees/${assessee.id}`);
  revalidatePath(`/batches/${batch.id}/assessees/${assessee.id}/interview`);
  revalidatePath(`/batches/${batch.id}/ak05`);

  return {
    ok: true,
    message: `Penilaian wawancara FR.IA.09 (${data.overallRecommendation}) tersimpan dan roll-up VATM diperbarui.`,
  };
}
