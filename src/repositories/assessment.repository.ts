import { desc, eq } from "drizzle-orm";
import { hasDatabaseUrl, runRepositoryDualPath, withRlsTransaction } from "@/db";
import {
  ditAnalyses,
  writtenGradings,
  similarityPairs,
  decisions,
  ak05Reports,
  interviewAssessments,
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

export async function listWrittenGradingsForBatch(userId: string, batchId: string) {
  if (hasDatabaseUrl()) {
    return withRlsTransaction(userId, (tx) =>
      tx
        .select()
        .from(writtenGradings)
        .where(eq(writtenGradings.batchId, batchId))
        .orderBy(desc(writtenGradings.createdAt)),
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("written_gradings")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false });

  return data ?? [];
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

export async function listDecisionsForBatch(userId: string, batchId: string) {
  if (hasDatabaseUrl()) {
    return withRlsTransaction(userId, (tx) =>
      tx.select().from(decisions).where(eq(decisions.batchId, batchId)),
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("decisions").select("*").eq("batch_id", batchId);
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

export async function saveSimilarityPairsForBatch(params: {
  userId: string;
  lspId: string;
  batchId: string;
  pairs: Array<{
    scope: string;
    assesseeAId: string;
    assesseeBId: string;
    jaccardScore: number;
    tfidfCosine: number;
    sharedSpans: unknown;
    verdict: string;
  }>;
}): Promise<void> {
  if (params.pairs.length === 0) return;

  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssessmentRepository.saveSimilarityPairs",
    drizzle: async (tx) => {
      const existing = await tx
        .select({
          id: similarityPairs.id,
          scope: similarityPairs.scope,
          assesseeAId: similarityPairs.assesseeAId,
          assesseeBId: similarityPairs.assesseeBId,
        })
        .from(similarityPairs)
        .where(eq(similarityPairs.batchId, params.batchId));

      const existingMap = new Map(
        existing.map((r) => [`${r.scope}:${r.assesseeAId}:${r.assesseeBId}`, r.id]),
      );

      for (const p of params.pairs) {
        const existingId = existingMap.get(`${p.scope}:${p.assesseeAId}:${p.assesseeBId}`);
        if (existingId) {
          await tx
            .update(similarityPairs)
            .set({
              jaccardScore: p.jaccardScore.toFixed(4),
              tfidfCosine: p.tfidfCosine.toFixed(4),
              sharedSpans: p.sharedSpans,
              verdict: p.verdict,
            })
            .where(eq(similarityPairs.id, existingId));
        } else {
          await tx.insert(similarityPairs).values({
            lspId: params.lspId,
            batchId: params.batchId,
            scope: p.scope,
            assesseeAId: p.assesseeAId,
            assesseeBId: p.assesseeBId,
            jaccardScore: p.jaccardScore.toFixed(4),
            tfidfCosine: p.tfidfCosine.toFixed(4),
            sharedSpans: p.sharedSpans,
            verdict: p.verdict,
          });
        }
      }
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data: existingRows } = await supabase
        .from("similarity_pairs")
        .select("id, scope, assessee_a_id, assessee_b_id")
        .eq("batch_id", params.batchId);

      const existingMap = new Map<string, string>(
        (existingRows ?? []).map((r) => [
          `${String(r.scope)}:${String(r.assessee_a_id)}:${String(r.assessee_b_id)}`,
          String(r.id),
        ]),
      );

      for (const p of params.pairs) {
        const existingId = existingMap.get(`${p.scope}:${p.assesseeAId}:${p.assesseeBId}`);
        if (existingId) {
          await supabase
            .from("similarity_pairs")
            .update({
              jaccard_score: p.jaccardScore,
              tfidf_cosine: p.tfidfCosine,
              shared_spans: p.sharedSpans,
              verdict: p.verdict,
            })
            .eq("id", existingId);
        } else {
          await supabase.from("similarity_pairs").insert({
            lsp_id: params.lspId,
            batch_id: params.batchId,
            scope: p.scope,
            assessee_a_id: p.assesseeAId,
            assessee_b_id: p.assesseeBId,
            jaccard_score: p.jaccardScore,
            tfidf_cosine: p.tfidfCosine,
            shared_spans: p.sharedSpans,
            verdict: p.verdict,
          });
        }
      }
    },
  });
}

export async function saveAk05ReportForBatch(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assessorId: string;
  assessorRegNo?: string | null;
  tukType: string;
  status?: string;
  rows: unknown;
  notesPositiveNegative?: string;
  notesRejection?: string;
  notesImprovement?: string;
  signatureId?: string | null;
}): Promise<void> {
  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssessmentRepository.saveAk05Report",
    drizzle: async (tx) => {
      await tx.insert(ak05Reports).values({
        lspId: params.lspId,
        batchId: params.batchId,
        assessorId: params.assessorId,
        assessorRegNo: params.assessorRegNo ?? null,
        tukType: params.tukType,
        status: params.status ?? "draft",
        rows: params.rows,
        notesPositiveNegative: params.notesPositiveNegative ?? "",
        notesRejection: params.notesRejection ?? "",
        notesImprovement: params.notesImprovement ?? "",
        signatureId: params.signatureId ?? null,
      });
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      await supabase.from("ak05_reports").insert({
        lsp_id: params.lspId,
        batch_id: params.batchId,
        assessor_id: params.assessorId,
        assessor_reg_no: params.assessorRegNo ?? null,
        tuk_type: params.tukType,
        status: params.status ?? "draft",
        rows: params.rows,
        notes_positive_negative: params.notesPositiveNegative ?? "",
        notes_rejection: params.notesRejection ?? "",
        notes_improvement: params.notesImprovement ?? "",
        signature_id: params.signatureId ?? null,
      });
    },
  });
}

export async function getLatestInterviewAssessment(userId: string, assesseeId: string) {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx
        .select()
        .from(interviewAssessments)
        .where(eq(interviewAssessments.assesseeId, assesseeId))
        .orderBy(desc(interviewAssessments.createdAt))
        .limit(1),
    );
    return rows[0] ?? null;
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("interview_assessments")
    .select("*")
    .eq("assessee_id", assesseeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function saveInterviewAssessment(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  sourceFileId?: string | null;
  questions: unknown;
  overallRecommendation: "K" | "BK";
  vatmUnitRecommendations: unknown;
  assessorNotes: string;
}): Promise<void> {
  const now = new Date();
  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssessmentRepository.saveInterviewAssessment",
    drizzle: async (tx) => {
      await tx.insert(interviewAssessments).values({
        lspId: params.lspId,
        batchId: params.batchId,
        assesseeId: params.assesseeId,
        sourceFileId: params.sourceFileId ?? null,
        questions: params.questions,
        overallRecommendation: params.overallRecommendation,
        vatmUnitRecommendations: params.vatmUnitRecommendations,
        assessorNotes: params.assessorNotes,
        assessedBy: params.userId,
        assessedAt: now,
      });
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      await supabase.from("interview_assessments").insert({
        lsp_id: params.lspId,
        batch_id: params.batchId,
        assessee_id: params.assesseeId,
        source_file_id: params.sourceFileId ?? null,
        questions: params.questions,
        overall_recommendation: params.overallRecommendation,
        vatm_unit_recommendations: params.vatmUnitRecommendations,
        assessor_notes: params.assessorNotes,
        assessed_by: params.userId,
        assessed_at: now.toISOString(),
      });
    },
  });
}

/**
 * Updates AI/channel VATM unit recommendations on `decisions` without overwriting
 * an existing human-confirmed `decision`.
 */
export async function upsertAiUnitRecommendations(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  items: Array<{
    unitCode: string;
    unitTitle: string;
    aiRecommendation: "K" | "BK" | null;
    vatmReasoning: string;
  }>;
}): Promise<void> {
  const validItems = params.items.filter(
    (item) => item.unitCode.trim() && item.aiRecommendation !== null,
  );
  if (validItems.length === 0) return;

  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssessmentRepository.upsertAiUnitRecommendations",
    drizzle: async (tx) => {
      for (const item of validItems) {
        await tx
          .insert(decisions)
          .values({
            lspId: params.lspId,
            batchId: params.batchId,
            assesseeId: params.assesseeId,
            unitCode: item.unitCode,
            unitTitle: item.unitTitle,
            aiRecommendation: item.aiRecommendation,
            vatmReasoning: item.vatmReasoning,
          })
          .onConflictDoUpdate({
            target: [decisions.assesseeId, decisions.unitCode],
            set: {
              unitTitle: item.unitTitle,
              aiRecommendation: item.aiRecommendation,
              vatmReasoning: item.vatmReasoning,
            },
          });
      }
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      await supabase.from("decisions").upsert(
        validItems.map((item) => ({
          lsp_id: params.lspId,
          batch_id: params.batchId,
          assessee_id: params.assesseeId,
          unit_code: item.unitCode,
          unit_title: item.unitTitle,
          ai_recommendation: item.aiRecommendation,
          vatm_reasoning: item.vatmReasoning,
        })),
        { onConflict: "assessee_id,unit_code" },
      );
    },
  });
}
