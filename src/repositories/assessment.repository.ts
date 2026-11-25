import { desc, eq, sql } from "drizzle-orm";
import { runRepositoryDualPath } from "@/db";
import {
  ditAnalyses,
  writtenGradings,
  similarityPairs,
  decisions,
  ak05Reports,
  interviewAssessments,
  assesseeDecisionOverrides,
} from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getLatestDitAnalysis(userId: string, assesseeId: string) {
  return runRepositoryDualPath({
    userId,
    label: "AssessmentRepository.getLatestDitAnalysis",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(ditAnalyses)
        .where(eq(ditAnalyses.assesseeId, assesseeId))
        .orderBy(desc(ditAnalyses.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("dit_analyses")
        .select("*")
        .eq("assessee_id", assesseeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data ?? null;
    },
  });
}

export async function listDitAnalysesForBatch(userId: string, batchId: string) {
  return runRepositoryDualPath({
    userId,
    label: "AssessmentRepository.listDitAnalysesForBatch",
    drizzle: async (tx) =>
      tx
        .select()
        .from(ditAnalyses)
        .where(eq(ditAnalyses.batchId, batchId))
        .orderBy(desc(ditAnalyses.createdAt)),
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("dit_analyses")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false });

      return data ?? [];
    },
  });
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
}): Promise<void> {
  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssessmentRepository.saveDitAnalysis",
    drizzle: async (tx) => {
      await tx.insert(ditAnalyses).values({
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
      });
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase.from("dit_analyses").insert({
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
      if (error) {
        throw new Error(`DIT_ANALYSIS_INSERT_FAILED: ${error.message}`);
      }
    },
  });
}

export async function saveOfficial04bAssessment(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  official04b: Record<string, unknown>;
}): Promise<void> {
  const now = new Date();
  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssessmentRepository.saveOfficial04bAssessment",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(ditAnalyses)
        .where(eq(ditAnalyses.assesseeId, params.assesseeId))
        .orderBy(desc(ditAnalyses.createdAt))
        .limit(1);
      const latest = rows[0];
      if (latest) {
        const prev =
          latest.official04b && typeof latest.official04b === "object"
            ? (latest.official04b as Record<string, unknown>)
            : {};
        await tx
          .update(ditAnalyses)
          .set({
            official04b: { ...prev, ...params.official04b },
            updatedAt: now,
          })
          .where(eq(ditAnalyses.id, latest.id));
        return;
      }

      await tx.insert(ditAnalyses).values({
        lspId: params.lspId,
        batchId: params.batchId,
        assesseeId: params.assesseeId,
        model: "manual-assessor-04b",
        promptVersion: "manual",
        coverageMatrix: [],
        gapQuestions: [],
        questionBank: [],
        modelAnswers: [],
        readiness: {},
        official04b: params.official04b,
        status: "done",
        rawOutput: null,
        createdBy: params.userId,
      });
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data: latest, error: fetchErr } = await supabase
        .from("dit_analyses")
        .select("id, official_04b")
        .eq("assessee_id", params.assesseeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) {
        throw new Error(`DIT_ANALYSIS_FETCH_FAILED: ${fetchErr.message}`);
      }

      if (latest?.id) {
        const prev =
          latest.official_04b && typeof latest.official_04b === "object"
            ? (latest.official_04b as Record<string, unknown>)
            : {};
        const { error: updateErr } = await supabase
          .from("dit_analyses")
          .update({
            official_04b: { ...prev, ...params.official04b },
            updated_at: now.toISOString(),
          })
          .eq("id", latest.id);
        if (updateErr) {
          throw new Error(`OFFICIAL_04B_UPDATE_FAILED: ${updateErr.message}`);
        }
        return;
      }

      const { error: insertErr } = await supabase.from("dit_analyses").insert({
        lsp_id: params.lspId,
        batch_id: params.batchId,
        assessee_id: params.assesseeId,
        model: "manual-assessor-04b",
        prompt_version: "manual",
        coverage_matrix: [],
        gap_questions: [],
        question_bank: [],
        model_answers: [],
        readiness: {},
        official_04b: params.official04b,
        status: "done",
        raw_output: null,
        created_by: params.userId,
      });
      if (insertErr) {
        throw new Error(`OFFICIAL_04B_INSERT_FAILED: ${insertErr.message}`);
      }
    },
  });
}

export async function getLatestWrittenGrading(userId: string, assesseeId: string) {
  return runRepositoryDualPath({
    userId,
    label: "AssessmentRepository.getLatestWrittenGrading",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(writtenGradings)
        .where(eq(writtenGradings.assesseeId, assesseeId))
        .orderBy(desc(writtenGradings.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("written_gradings")
        .select("*")
        .eq("assessee_id", assesseeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data ?? null;
    },
  });
}

export async function listWrittenGradingsForBatch(userId: string, batchId: string) {
  return runRepositoryDualPath({
    userId,
    label: "AssessmentRepository.listWrittenGradingsForBatch",
    drizzle: async (tx) =>
      tx
        .select()
        .from(writtenGradings)
        .where(eq(writtenGradings.batchId, batchId))
        .orderBy(desc(writtenGradings.createdAt)),
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("written_gradings")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false });

      return data ?? [];
    },
  });
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
  confirmedBy?: string | null;
  confirmedAt?: Date | string | null;
}): Promise<void> {
  const confirmedAtDate =
    params.confirmedAt instanceof Date
      ? params.confirmedAt
      : typeof params.confirmedAt === "string" && params.confirmedAt.trim()
        ? new Date(params.confirmedAt)
        : null;
  const confirmedAtIso = confirmedAtDate ? confirmedAtDate.toISOString() : null;

  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssessmentRepository.saveWrittenGrading",
    drizzle: async (tx) => {
      await tx.insert(writtenGradings).values({
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
        ...(params.confirmedBy ? { confirmedBy: params.confirmedBy } : {}),
        ...(confirmedAtDate ? { confirmedAt: confirmedAtDate } : {}),
      });
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase.from("written_gradings").insert({
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
        ...(params.confirmedBy ? { confirmed_by: params.confirmedBy } : {}),
        ...(confirmedAtIso ? { confirmed_at: confirmedAtIso } : {}),
      });
      if (error) {
        throw new Error(`WRITTEN_GRADING_INSERT_FAILED: ${error.message}`);
      }
    },
  });
}

export async function saveOfficial06cAssessment(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  official06c: Record<string, unknown>;
}): Promise<void> {
  const now = new Date();
  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssessmentRepository.saveOfficial06cAssessment",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(writtenGradings)
        .where(eq(writtenGradings.assesseeId, params.assesseeId))
        .orderBy(desc(writtenGradings.createdAt))
        .limit(1);
      const latest = rows[0];
      if (latest) {
        const prevMapping =
          latest.formMapping && typeof latest.formMapping === "object"
            ? (latest.formMapping as Record<string, unknown>)
            : {};
        await tx
          .update(writtenGradings)
          .set({
            formMapping: { ...prevMapping, official06c: params.official06c },
            confirmedBy: params.userId,
            confirmedAt: now,
            updatedAt: now,
          })
          .where(eq(writtenGradings.id, latest.id));
        return;
      }

      await tx.insert(writtenGradings).values({
        lspId: params.lspId,
        batchId: params.batchId,
        assesseeId: params.assesseeId,
        formMapping: {
          soal: "06A",
          kunci: "06B",
          jawaban: "06C",
          official06c: params.official06c,
        },
        itemVerdicts: [],
        errorSummary: [],
        vatmUnitRecommendations: [],
        plagiarismReport: {},
        model: "manual-assessor-06c",
        promptVersion: "manual",
        confirmedBy: params.userId,
        confirmedAt: now,
      });
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data: latest, error: fetchErr } = await supabase
        .from("written_gradings")
        .select("id, form_mapping")
        .eq("assessee_id", params.assesseeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) {
        throw new Error(`WRITTEN_GRADING_FETCH_FAILED: ${fetchErr.message}`);
      }

      if (latest?.id) {
        const prevMapping =
          latest.form_mapping && typeof latest.form_mapping === "object"
            ? (latest.form_mapping as Record<string, unknown>)
            : {};
        const { error: updateErr } = await supabase
          .from("written_gradings")
          .update({
            form_mapping: { ...prevMapping, official06c: params.official06c },
            confirmed_by: params.userId,
            confirmed_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", latest.id);
        if (updateErr) {
          throw new Error(`OFFICIAL_06C_UPDATE_FAILED: ${updateErr.message}`);
        }
        return;
      }

      const { error: insertErr } = await supabase.from("written_gradings").insert({
        lsp_id: params.lspId,
        batch_id: params.batchId,
        assessee_id: params.assesseeId,
        form_mapping: {
          soal: "06A",
          kunci: "06B",
          jawaban: "06C",
          official06c: params.official06c,
        },
        item_verdicts: [],
        error_summary: [],
        vatm_unit_recommendations: [],
        plagiarism_report: {},
        model: "manual-assessor-06c",
        prompt_version: "manual",
        confirmed_by: params.userId,
        confirmed_at: now.toISOString(),
      });
      if (insertErr) {
        throw new Error(`OFFICIAL_06C_INSERT_FAILED: ${insertErr.message}`);
      }
    },
  });
}

export async function listDecisionsForAssessee(userId: string, assesseeId: string) {
  return runRepositoryDualPath({
    userId,
    label: "AssessmentRepository.listDecisionsForAssessee",
    drizzle: async (tx) =>
      tx.select().from(decisions).where(eq(decisions.assesseeId, assesseeId)),
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase.from("decisions").select("*").eq("assessee_id", assesseeId);
      return data ?? [];
    },
  });
}

export async function listDecisionsForBatch(userId: string, batchId: string) {
  return runRepositoryDualPath({
    userId,
    label: "AssessmentRepository.listDecisionsForBatch",
    drizzle: async (tx) =>
      tx.select().from(decisions).where(eq(decisions.batchId, batchId)),
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase.from("decisions").select("*").eq("batch_id", batchId);
      return data ?? [];
    },
  });
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
}): Promise<void> {
  const now = new Date();
  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssessmentRepository.upsertUnitDecision",
    drizzle: async (tx) => {
      await tx
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
        });
    },
    supabase: async () => {
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
    },
  });
}

export async function listSimilarityPairsByBatch(userId: string, batchId: string) {
  return runRepositoryDualPath({
    userId,
    label: "AssessmentRepository.listSimilarityPairsByBatch",
    drizzle: async (tx) =>
      tx.select().from(similarityPairs).where(eq(similarityPairs.batchId, batchId)),
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase.from("similarity_pairs").select("*").eq("batch_id", batchId);
      return data ?? [];
    },
  });
}

export async function getAk05ReportForBatch(userId: string, batchId: string) {
  return runRepositoryDualPath({
    userId,
    label: "AssessmentRepository.getAk05ReportForBatch",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(ak05Reports)
        .where(eq(ak05Reports.batchId, batchId))
        .orderBy(desc(ak05Reports.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("ak05_reports")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data ?? null;
    },
  });
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
  return runRepositoryDualPath({
    userId,
    label: "AssessmentRepository.getLatestInterviewAssessment",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(interviewAssessments)
        .where(eq(interviewAssessments.assesseeId, assesseeId))
        .orderBy(desc(interviewAssessments.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("interview_assessments")
        .select("*")
        .eq("assessee_id", assesseeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data ?? null;
    },
  });
}

export async function listInterviewAssessmentsForBatch(userId: string, batchId: string) {
  return runRepositoryDualPath({
    userId,
    label: "AssessmentRepository.listInterviewAssessmentsForBatch",
    drizzle: async (tx) =>
      tx
        .select()
        .from(interviewAssessments)
        .where(eq(interviewAssessments.batchId, batchId))
        .orderBy(desc(interviewAssessments.createdAt)),
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("interview_assessments")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false });

      return data ?? [];
    },
  });
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

export interface AssesseeDecisionOverrideRecord {
  id: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  overrideDecision: "K" | "BK" | null;
  overrideReason: string;
  overriddenBy: string | null;
  overriddenAt: string | null;
  version: number;
}

function isMissingOverrideTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /42P01|PGRST205|does not exist|Could not find the table/i.test(msg);
}

function normalizeDecisionOverrideRow(
  row: Record<string, unknown>,
): AssesseeDecisionOverrideRecord {
  const rawDecision = row.overrideDecision ?? row.override_decision;
  const overrideDecision =
    rawDecision === "K" || rawDecision === "BK" ? rawDecision : null;
  const rawAt = row.overriddenAt ?? row.overridden_at;
  const overriddenAt =
    rawAt instanceof Date
      ? rawAt.toISOString()
      : typeof rawAt === "string"
        ? rawAt
        : null;
  const rawBy = row.overriddenBy ?? row.overridden_by;
  return {
    id: String(row.id ?? ""),
    lspId: String(row.lspId ?? row.lsp_id ?? ""),
    batchId: String(row.batchId ?? row.batch_id ?? ""),
    assesseeId: String(row.assesseeId ?? row.assessee_id ?? ""),
    overrideDecision,
    overrideReason: String(row.overrideReason ?? row.override_reason ?? ""),
    overriddenBy: typeof rawBy === "string" && rawBy.length > 0 ? rawBy : null,
    overriddenAt,
    version: Number(row.version ?? 1),
  };
}

export async function getAssesseeDecisionOverride(
  userId: string,
  assesseeId: string,
): Promise<AssesseeDecisionOverrideRecord | null> {
  try {
    return await runRepositoryDualPath({
      userId,
      label: "AssessmentRepository.getAssesseeDecisionOverride",
      drizzle: async (tx) => {
        const rows = await tx
          .select()
          .from(assesseeDecisionOverrides)
          .where(eq(assesseeDecisionOverrides.assesseeId, assesseeId))
          .limit(1);
        return rows[0]
          ? normalizeDecisionOverrideRow(rows[0] as unknown as Record<string, unknown>)
          : null;
      },
      supabase: async () => {
        const supabase = await getSupabaseServerClient();
        const { data, error } = await supabase
          .from("assessee_decision_overrides")
          .select("*")
          .eq("assessee_id", assesseeId)
          .maybeSingle();
        if (error) {
          if (isMissingOverrideTableError(error.message)) return null;
          throw new Error(error.message);
        }
        return data
          ? normalizeDecisionOverrideRow(data as Record<string, unknown>)
          : null;
      },
    });
  } catch (err) {
    if (isMissingOverrideTableError(err)) return null;
    throw err;
  }
}

export async function listBatchDecisionOverrides(
  userId: string,
  batchId: string,
): Promise<AssesseeDecisionOverrideRecord[]> {
  try {
    return await runRepositoryDualPath({
      userId,
      label: "AssessmentRepository.listBatchDecisionOverrides",
      drizzle: async (tx) => {
        const rows = await tx
          .select()
          .from(assesseeDecisionOverrides)
          .where(eq(assesseeDecisionOverrides.batchId, batchId));
        return rows.map((row) =>
          normalizeDecisionOverrideRow(row as unknown as Record<string, unknown>),
        );
      },
      supabase: async () => {
        const supabase = await getSupabaseServerClient();
        const { data, error } = await supabase
          .from("assessee_decision_overrides")
          .select("*")
          .eq("batch_id", batchId);
        if (error) {
          if (isMissingOverrideTableError(error.message)) return [];
          throw new Error(error.message);
        }
        return (data ?? []).map((row) =>
          normalizeDecisionOverrideRow(row as Record<string, unknown>),
        );
      },
    });
  } catch (err) {
    if (isMissingOverrideTableError(err)) return [];
    throw err;
  }
}

export async function upsertAssesseeDecisionOverride(params: {
  userId: string;
  lspId: string;
  batchId: string;
  assesseeId: string;
  overrideDecision: "K" | "BK" | null;
  overrideReason: string;
}): Promise<AssesseeDecisionOverrideRecord> {
  const now = new Date();
  const cleanReason = params.overrideReason.trim();

  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssessmentRepository.upsertAssesseeDecisionOverride",
    fallbackOnError: false,
    drizzle: async (tx) => {
      const [row] = await tx
        .insert(assesseeDecisionOverrides)
        .values({
          lspId: params.lspId,
          batchId: params.batchId,
          assesseeId: params.assesseeId,
          overrideDecision: params.overrideDecision,
          overrideReason: cleanReason,
          overriddenBy: params.userId,
          overriddenAt: now,
          version: 1,
        })
        .onConflictDoUpdate({
          target: [assesseeDecisionOverrides.assesseeId],
          set: {
            overrideDecision: params.overrideDecision,
            overrideReason: cleanReason,
            overriddenBy: params.userId,
            overriddenAt: now,
            version: sql`${assesseeDecisionOverrides.version} + 1`,
          },
        })
        .returning();
      return normalizeDecisionOverrideRow(row as unknown as Record<string, unknown>);
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data: existing } = await supabase
        .from("assessee_decision_overrides")
        .select("version")
        .eq("assessee_id", params.assesseeId)
        .maybeSingle();
      const nextVersion = Number(existing?.version ?? 0) + 1;
      const { data, error } = await supabase
        .from("assessee_decision_overrides")
        .upsert(
          {
            lsp_id: params.lspId,
            batch_id: params.batchId,
            assessee_id: params.assesseeId,
            override_decision: params.overrideDecision,
            override_reason: cleanReason,
            overridden_by: params.userId,
            overridden_at: now.toISOString(),
            version: nextVersion,
          },
          { onConflict: "assessee_id" },
        )
        .select("*")
        .single();
      if (error) {
        throw new Error(`[AssesseeDecisionOverride Error]: ${error.message}`);
      }
      return normalizeDecisionOverrideRow(data as Record<string, unknown>);
    },
  });
}
