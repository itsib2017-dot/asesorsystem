import { describe, expect, it } from "vitest";
import { isStaleRunningJob } from "../job-staleness";

describe("isStaleRunningJob", () => {
  const now = Date.parse("2026-11-20T10:00:00Z");

  it("marks a running job with no update for 6+ minutes as stale", () => {
    expect(
      isStaleRunningJob({ status: "running", updatedAt: "2026-11-20T09:50:00Z" }, now),
    ).toBe(true);
  });

  it("leaves fresh and terminal jobs alone", () => {
    expect(
      isStaleRunningJob({ status: "running", updatedAt: "2026-11-20T09:58:00Z" }, now),
    ).toBe(false);
    expect(
      isStaleRunningJob({ status: "done", updatedAt: "2026-11-20T09:00:00Z" }, now),
    ).toBe(false);
  });
});
