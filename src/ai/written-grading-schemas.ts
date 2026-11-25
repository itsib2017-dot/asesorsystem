import { z } from "zod";
import { writtenGradingSchema } from "@/ai/schemas";

/**
 * Round 22 P0-1: written grading is split into small structured calls so the
 * reasoning model can finish each one inside the LLM budget.
 * - Item chunk: verdicts for a small question range only.
 * - Rollup: VATM per unit + plagiarism, fed with the merged verdicts (no long spans).
 */
export const writtenGradingItemChunkSchema = z.object({
  itemVerdicts: writtenGradingSchema.shape.itemVerdicts,
});

export const writtenGradingRollupSchema = z.object({
  vatmUnitRecommendations: writtenGradingSchema.shape.vatmUnitRecommendations,
  plagiarismReport: writtenGradingSchema.shape.plagiarismReport,
});

export type WrittenGradingItemVerdict = z.infer<
  typeof writtenGradingItemChunkSchema
>["itemVerdicts"][number];
