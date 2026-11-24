import { describe, expect, it, vi } from "vitest";
import { waitForJob } from "../wait-for-job";

function jsonResponse(data: unknown): Response {
  return { ok: true, json: async () => ({ data }) } as Response;
}

describe("waitForJob", () => {
  it("returns the real worker failure instead of reporting enqueue success", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "running", progress: 10 }))
      .mockResolvedValueOnce(
        jsonResponse({ status: "failed", progress: 0, error: "BYOK quota exhausted" }),
      );

    await expect(waitForJob("job-1", fetcher, { pollMs: 0 })).resolves.toEqual({
      status: "failed",
      error: "BYOK quota exhausted",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("reports live status & progress updates via onProgress until terminal state", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "pending", progress: 0 }))
      .mockResolvedValueOnce(jsonResponse({ status: "running", progress: 10 }))
      .mockResolvedValueOnce(jsonResponse({ status: "done", progress: 100 }));
    const updates: Array<{ status: string; progress: number }> = [];

    await expect(
      waitForJob("job-2", fetcher, {
        pollMs: 0,
        onProgress: (snap) => updates.push(snap),
      }),
    ).resolves.toEqual({
      status: "done",
      error: null,
    });
    expect(updates).toEqual([
      { status: "pending", progress: 0 },
      { status: "running", progress: 10 },
      { status: "done", progress: 100 },
    ]);
  });
});
