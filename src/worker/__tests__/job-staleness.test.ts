import { describe, expect, it } from "vitest";
import {
  STALE_PENDING_MS,
  STALE_RUNNING_MS,
  getStaleJobReason,
  isStalePendingJob,
  isStaleRunningJob,
} from "../job-staleness";

describe("job staleness guards", () => {
  const now = Date.parse("2026-11-20T10:00:00Z");

  it("marks a running job with no update for 6+ minutes as stale", () => {
    expect(STALE_RUNNING_MS).toBe(305_000);
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

  it("marks a pending job older than 60s as stale while sparing fresh pending jobs", () => {
    expect(STALE_PENDING_MS).toBe(60_000);
    expect(
      isStalePendingJob({ status: "pending", updatedAt: "2026-11-20T09:58:30Z" }, now),
    ).toBe(true);
    expect(
      isStalePendingJob({ status: "pending", updatedAt: "2026-11-20T09:59:20Z" }, now),
    ).toBe(false);
    expect(
      isStalePendingJob({ status: "done", updatedAt: "2026-11-20T09:00:00Z" }, now),
    ).toBe(false);
  });

  it("returns distinct Indonesian reasons for stale running vs stale pending jobs", () => {
    expect(
      getStaleJobReason({ status: "running", updatedAt: "2026-11-20T09:54:00Z" }, now),
    ).toContain("300s");
    expect(
      getStaleJobReason({ status: "pending", updatedAt: "2026-11-20T09:58:00Z" }, now),
    ).toContain("60 detik");
    expect(
      getStaleJobReason({ status: "running", updatedAt: "2026-11-20T09:59:00Z" }, now),
    ).toBeNull();
  });
});
