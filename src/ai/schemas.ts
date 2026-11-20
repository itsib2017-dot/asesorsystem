import { z } from "zod";

export const dimensionCodeSchema = z.enum(["TS", "TMS", "CMS", "JRES", "TrS"]);

export const coverageStatusSchema = z.enum([
  "Terpenuhi",
  "Sebagian",
  "Belum Dibahas",
]);

export const binaryDecisionSchema = z.enum(["Kompeten", "Belum Kompeten"]);
export const binaryDecisionCodeSchema = z.enum(["K", "BK"]);

export function buildDitAnalysisSchema(expectedQuestionCount: number) {
  return z.object({
    candidateProfileSummary: z.object({
      pseudonym: z.string(),
      educationalBackground: z.string(),
      workExperienceSummary: z.string(),
      roleLevel: z.string(),
      region: z.string(),
      industrySector: z.string(),
    }),
    coverageMatrix: z.array(
      z.object({
        no: z.number().int().positive(),
        kelompokPekerjaan: z.string(),
        focusPoint: z.string(),
        status: coverageStatusSchema,
        evidenceSpan: z.string(),
        notes: z.string(),
      }),
    ),
    gapQuestions: z.array(
      z.object({
        kelompokPekerjaan: z.string(),
        focusPoint: z.string(),
        dimension: dimensionCodeSchema,
        question: z.string(),
      }),
    ),
    questionBank: z
      .array(
        z.object({
          no: z.number().int().positive(),
          dimension: dimensionCodeSchema,
          kelompokPekerjaan: z.string(),
          question: z.string(),
          modelAnswerKeyPoints: z.array(z.string()).min(1),
        }),
      )
      .length(expectedQuestionCount),
    readiness: z.object({
      readiness_pct: z.number().min(0).max(100),
      strengths: z.array(z.string()),
      critical_gaps: z.array(z.string()),
      follow_up_actions: z.array(z.string()),
      recommendation: binaryDecisionSchema,
      readiness_recommendation_note: z.string(),
    }),
  });
}

export function buildInterviewQuestionsSchema(expectedQuestionCount: number) {
  return z.object({
    coverage: z.array(
      z.object({
        unitCode: z.string(),
        status: coverageStatusSchema,
        reason: z.string(),
      }),
    ),
    gapQuestions: z.array(
      z.object({
        unitCode: z.string(),
        dimension: dimensionCodeSchema,
        question: z.string(),
      }),
    ),
    interviewQuestions: z
      .array(
        z.object({
          no: z.number().int().positive(),
          unitCode: z.string(),
          question: z.string(),
        }),
      )
      .length(expectedQuestionCount),
    readiness: z.object({
      strengths: z.array(z.string()),
      criticalGaps: z.array(z.string()),
      recommendation: binaryDecisionCodeSchema,
    }),
  });
}

export const writtenGradingSchema = z.object({
  pseudonym: z.string(),
  itemVerdicts: z.array(
    z.object({
      questionNo: z.number().int().positive(),
      verdict: z.enum(["Benar", "Sebagian", "Salah"]),
      masterSpan: z.string(),
      studentSpan: z.string(),
      explanation: z.string(),
    }),
  ),
  ringkasanKesalahan: z.array(z.number().int().positive()),
  vatmUnitRecommendations: z.array(
    z.object({
      unitCode: z.string(),
      unitTitle: z.string(),
      valid: z.boolean(),
      asli: z.boolean(),
      terkini: z.boolean(),
      memadai: z.boolean(),
      recommendation: binaryDecisionCodeSchema,
      reasoning: z.string(),
    }),
  ),
  plagiarismReport: z.object({
    status: z.enum(["Bersih", "Waspada"]),
    reasoning: z.string(),
    flaggedQuestions: z.array(z.number().int().positive()),
  }),
});

export const nameJurySchema = z.object({
  verdict: z.enum(["match", "mismatch_resolved", "needs_human"]),
  proposed_certificate_name: z.string().nullable(),
  reasoning: z.string(),
  evidence: z.array(
    z.object({
      source: z.enum(["ktp_ocr", "apl01", "surat_tugas", "ijazah"]),
      span: z.string(),
    }),
  ),
  ocr_confidence: z.number().min(0).max(1),
});

export type WrittenGradingOutput = z.infer<typeof writtenGradingSchema>;
export type NameJuryOutput = z.infer<typeof nameJurySchema>;
