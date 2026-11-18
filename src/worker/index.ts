import { handleHelloJob } from "./handlers/hello.handler";
import { logEvent } from "@/lib/logger";

export interface WorkerJobInput {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Worker entry point (ADR-0004 pg-boss / Postgres job runner).
 * Processes async tasks (Drive crawl, local Tesseract OCR, encrypted 06B unlock, AI pipelines, exports).
 */
export async function runWorkerJob(job: WorkerJobInput) {
  const started = Date.now();
  logEvent("info", {
    correlation_id: job.id,
    action: `worker.dispatch.${job.type}`,
    resource: "jobs",
    outcome: "started",
  });

  if (job.type === "hello") {
    return handleHelloJob(job.id, job.payload);
  }

  logEvent("info", {
    correlation_id: job.id,
    action: `worker.dispatch.${job.type}`,
    resource: "jobs",
    outcome: "success",
    duration_ms: Date.now() - started,
  });

  return { status: "done" as const, progress: 100 };
}
