import { z } from "zod";
import { getUser } from "@/lib/auth/get-session";
import { apiError, apiSuccess } from "@/lib/errors";
import { listBatchesForUser, getBatchById } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { listSimilarityPairsByBatch } from "@/repositories/assessment.repository";
import { getJobStatus } from "@/worker/queue";

const mcpCallSchema = z.object({
  tool: z.enum([
    "list_batches",
    "get_batch_summary",
    "get_job_status",
    "similarity_report",
  ]),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

/**
 * MCP over Streamable HTTP P0 tool endpoint (doc 07 & 15 §5).
 * Routes through the exact same scoped repository/service layer with user auth & RLS.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Token MCP/sesi tidak valid.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Payload MCP JSON tidak valid.");
  }

  const parsed = mcpCallSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Nama tool atau argumen MCP tidak valid.");
  }

  const { tool, arguments: args } = parsed.data;

  if (tool === "list_batches") {
    const batches = await listBatchesForUser(user.id);
    return apiSuccess({ tool, result: batches });
  }

  if (tool === "get_batch_summary") {
    const batchId = String(args.batch_id ?? "");
    const batch = await getBatchById(user.id, batchId);
    if (!batch) return apiError("NOT_FOUND", "Batch tidak ditemukan.");
    const assessees = await listAssesseesByBatch(user.id, batchId);
    // Redact raw NIK/KTP data from MCP responses (Rule 12)
    return apiSuccess({
      tool,
      result: {
        batch,
        assesseeCount: assessees.length,
        confirmedNames: assessees.filter((a) => Boolean(a.certificateNameConfirmed)).length,
      },
    });
  }

  if (tool === "get_job_status") {
    const jobId = String(args.job_id ?? "");
    const job = await getJobStatus(user.id, jobId);
    if (!job) return apiError("NOT_FOUND", "Job tidak ditemukan.");
    return apiSuccess({ tool, result: job });
  }

  if (tool === "similarity_report") {
    const batchId = String(args.batch_id ?? "");
    const pairs = await listSimilarityPairsByBatch(user.id, batchId);
    return apiSuccess({ tool, result: pairs });
  }

  return apiError("VALIDATION_ERROR", "Tool MCP tidak dikenali.");
}
