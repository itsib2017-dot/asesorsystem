import { describe, expect, it, vi } from "vitest";
import { waitForJob } from "../wait-for-job";

function jsonResponse(data: unknown): Response {
  return { ok: true, json: async () => ({ data }) } as Response;
}

describe("waitForJob", () => {
  it("returns the real worker failure instead of reporting enqueue success", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "running" }))
      .mockResolvedValueOnce(
        jsonResponse({ status: "failed", error: "BYOK quota exhausted" }),
      );

    await expect(waitForJob("job-1", fetcher, { pollMs: 0 })).resolves.toEqual({
      status: "failed",
      error: "BYOK quota exhausted",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns done when the job completes", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ status: "done" }));
    await expect(waitForJob("job-2", fetcher, { pollMs: 0 })).resolves.toEqual({
      status: "done",
      error: null,
    });
  });
});
