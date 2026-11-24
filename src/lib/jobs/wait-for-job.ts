import { readApiResponse } from "@/lib/http/read-api-response";

export interface JobTerminalState {
  status: "done" | "failed" | "timeout";
  error: string | null;
}

type Fetcher = (url: string) => Promise<Response>;

/**
 * Wait for a queued job to reach a terminal state. Server Actions enqueue
 * asynchronously; reporting success on HTTP 202 hides worker failures.
 */
export async function waitForJob(
  jobId: string,
  fetcher: Fetcher = (url) => fetch(url, { cache: "no-store" }),
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<JobTerminalState> {
  const timeoutMs = options.timeoutMs ?? 310_000;
  const pollMs = options.pollMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetcher(`/api/v1/jobs/${encodeURIComponent(jobId)}`);
      if (res.ok) {
        const parsed = await readApiResponse<{ status?: string; error?: string | null }>(res);
        if (parsed.ok) {
          const status = parsed.data?.status;
          if (status === "done" || status === "failed") {
            return { status, error: parsed.data?.error ?? null };
          }
        }
      }
    } catch {
      // transient poll failure; retry until deadline
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return { status: "timeout", error: null };
}
