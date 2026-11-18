import { desc, eq } from "drizzle-orm";
import { hasDatabaseUrl, withRlsTransaction } from "@/db";
import {
  ditAnalyses,
  writtenGradings,
  similarityPairs,
  decisions,
  ak05Reports,
} from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getLatestDitAnalysis(userId: string, assesseeId: string) {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx
        .select()
        .from(ditAnalyses)
        .where(eq(ditAnalyses.assesseeId, assesseeId))
        .orderBy(desc(ditAnalyses.createdAt))
        .limit(1),
    );
    return rows[0] ?? null;
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("dit_analyses")
    .select("*")
    .eq("assessee_id", assesseeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function saveDitAnalysis(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  model: string;
  promptVersion: string;
  coverageMatrix: unknown;
  gapQuestions: unknown;
  questionBank: unknown;
  modelAnswers: unknown;
  readiness: unknown;
  official04b: unknown;
  status: "done" | "needs_manual_review" | "failed";
  rawOutput: unknown;
}) {
  if (hasDatabaseUrl()) {
    await withRlsTransaction(params.userId, (tx) =>
      tx.insert(ditAnalyses).values({
        lspId: params.lspId,
        batchId: params.batchId,
        assesseeId: params.assesseeId,
        model: params.model,
        promptVersion: params.promptVersion,
        coverageMatrix: params.coverageMatrix,
        gapQuestions: params.gapQuestions,
        questionBank: params.questionBank,
        modelAnswers: params.modelAnswers,
        readiness: params.readiness,
        official04b: params.official04b,
        status: params.status,
        rawOutput: params.rawOutput,
        createdBy: params.userId,
      }),
    );
    return;
  }

  const supabase = await getSupabaseServerClient();
  await supabase.from("dit_analyses").insert({
    lsp_id: params.lspId,
    batch_id: params.batchId,
    assessee_id: params.assesseeId,
    model: params.model,
    prompt_version: params.promptVersion,
    coverage_matrix: params.coverageMatrix,
    gap_questions: params.gapQuestions,
    question_bank: params.questionBank,
    model_answers: params.modelAnswers,
    readiness: params.readiness,
    official_04b: params.official04b,
    status: params.status,
    raw_output: params.rawOutput,
    created_by: params.userId,
  });
}

export async function getLatestWrittenGrading(userId: string, assesseeId: string) {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx
        .select()
        .from(writtenGradings)
        .where(eq(writtenGradings.assesseeId, assesseeId))
        .orderBy(desc(writtenGradings.createdAt))
        .limit(1),
    );
    return rows[0] ?? null;
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("written_gradings")
    .select("*")
    .eq("assessee_id", assesseeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function saveWrittenGrading(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  formMapping: unknown;
  itemVerdicts: unknown;
  errorSummary: unknown;
  vatmUnitRecommendations: unknown;
  plagiarismReport: unknown;
  model: string;
  promptVersion: string;
}) {
  if (hasDatabaseUrl()) {
    await withRlsTransaction(params.userId, (tx) =>
      tx.insert(writtenGradings).values({
        lspId: params.lspId,
        batchId: params.batchId,
        assesseeId: params.assesseeId,
        formMapping: params.formMapping,
        itemVerdicts: params.itemVerdicts,
        errorSummary: params.errorSummary,
        vatmUnitRecommendations: params.vatmUnitRecommendations,
        plagiarismReport: params.plagiarismReport,
        model: params.model,
        promptVersion: params.promptVersion,
      }),
    );
    return;
  }

  const supabase = await getSupabaseServerClient();
  await supabase.from("written_gradings").insert({
    lsp_id: params.lspId,
    batch_id: params.batchId,
    assessee_id: params.assesseeId,
    form_mapping: params.formMapping,
    item_verdicts: params.itemVerdicts,
    error_summary: params.errorSummary,
    vatm_unit_recommendations: params.vatmUnitRecommendations,
    plagiarism_report: params.plagiarismReport,
    model: params.model,
    prompt_version: params.promptVersion,
  });
}

export async function listDecisionsForAssessee(userId: string, assesseeId: string) {
  if (hasDatabaseUrl()) {
    return withRlsTransaction(userId, (tx) =>
      tx.select().from(decisions).where(eq(decisions.assesseeId, assesseeId)),
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("decisions").select("*").eq("assessee_id", assesseeId);
  return data ?? [];
}

export async function upsertUnitDecision(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  unitCode: string;
  unitTitle: string;
  aiRecommendation?: "K" | "BK";
  vatmReasoning?: string;
  decision: "K" | "BK";
  assessorNote?: string;
}) {
  const now = new Date();
  if (hasDatabaseUrl()) {
    await withRlsTransaction(params.userId, (tx) =>
      tx
        .insert(decisions)
        .values({
          lspId: params.lspId,
          batchId: params.batchId,
          assesseeId: params.assesseeId,
          unitCode: params.unitCode,
          unitTitle: params.unitTitle,
          aiRecommendation: params.aiRecommendation ?? null,
          vatmReasoning: params.vatmReasoning ?? null,
          decision: params.decision,
          assessorNote: params.assessorNote ?? null,
          decidedBy: params.userId,
          decidedAt: now,
        })
        .onConflictDoUpdate({
          target: [decisions.assesseeId, decisions.unitCode],
          set: {
            decision: params.decision,
            assessorNote: params.assessorNote ?? null,
            decidedBy: params.userId,
            decidedAt: now,
          },
        }),
    );
    return;
  }

  const supabase = await getSupabaseServerClient();
  await supabase.from("decisions").upsert(
    {
      lsp_id: params.lspId,
      batch_id: params.batchId,
      assessee_id: params.assesseeId,
      unit_code: params.unitCode,
      unit_title: params.unitTitle,
      ai_recommendation: params.aiRecommendation ?? null,
      vatm_reasoning: params.vatmReasoning ?? null,
      decision: params.decision,
      assessor_note: params.assessorNote ?? null,
      decided_by: params.userId,
      decided_at: now.toISOString(),
    },
    { onConflict: "assessee_id,unit_code" },
  );
}

export async function listSimilarityPairsByBatch(userId: string, batchId: string) {
  if (hasDatabaseUrl()) {
    return withRlsTransaction(userId, (tx) =>
      tx.select().from(similarityPairs).where(eq(similarityPairs.batchId, batchId)),
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("similarity_pairs").select("*").eq("batch_id", batchId);
  return data ?? [];
}

export async function getAk05ReportForBatch(userId: string, batchId: string) {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx
        .select()
        .from(ak05Reports)
        .where(eq(ak05Reports.batchId, batchId))
        .orderBy(desc(ak05Reports.createdAt))
        .limit(1),
    );
    return rows[0] ?? null;
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("ak05_reports")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
