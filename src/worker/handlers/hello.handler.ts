import { logEvent } from "@/lib/logger";

export async function handleHelloJob(jobId: string, payload: Record<string, unknown>) {
  logEvent("info", {
    correlation_id: jobId,
    action: "worker.hello",
    resource: "jobs",
    outcome: "success",
    meta: { message: String(payload.message ?? "Hello from worker") },
  });
  return { status: "done" as const, progress: 100 };
}
