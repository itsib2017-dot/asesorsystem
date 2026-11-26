import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getBatchById: vi.fn(),
  listAssesseesByBatch: vi.fn(),
  listDriveFilesForBatch: vi.fn(),
  getLatestJobStatusForBatch: vi.fn(),
}));

vi.mock("@/lib/auth/get-session", () => ({ getUser: mocks.getUser }));
vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mocks.getBatchById,
  listDriveFilesForBatch: mocks.listDriveFilesForBatch,
}));
vi.mock("@/repositories/assessees.repository", () => ({
  listAssesseesByBatch: mocks.listAssesseesByBatch,
}));
vi.mock("@/worker/queue", () => ({
  getLatestJobStatusForBatch: mocks.getLatestJobStatusForBatch,
}));

import { GET } from "../route";

const BATCH_ID = "11111111-1111-4111-8111-111111111111";

describe("GET /api/v1/batches/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: "user-1", email: "asesor@test.id" });
    mocks.listAssesseesByBatch.mockResolvedValue([]);
    mocks.listDriveFilesForBatch.mockResolvedValue([]);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mocks.getUser.mockResolvedValueOnce(null);
    const res = await GET(new Request(`http://localhost/api/v1/batches/${BATCH_ID}`), {
      params: Promise.resolve({ id: BATCH_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when batch is missing or inaccessible", async () => {
    mocks.getBatchById.mockResolvedValueOnce(null);
    mocks.getLatestJobStatusForBatch.mockResolvedValueOnce(null);
    const res = await GET(new Request(`http://localhost/api/v1/batches/${BATCH_ID}`), {
      params: Promise.resolve({ id: BATCH_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("uses reconciled drive_scan job status so stale jobs surface as failed with error", async () => {
    mocks.getBatchById.mockResolvedValueOnce({
      id: BATCH_ID,
      name: "Batch P23",
      lspId: "lsp-1",
    });
    mocks.getLatestJobStatusForBatch.mockResolvedValueOnce({
      id: "job-stale-1",
      type: "drive_scan",
      status: "failed",
      progress: 10,
      error: "Worker timeout (Vercel 300s). Jalankan ulang pemindaian / analisis.",
      attempts: 1,
      updatedAt: "2026-11-26T11:25:00Z",
    });

    const res = await GET(new Request(`http://localhost/api/v1/batches/${BATCH_ID}`), {
      params: Promise.resolve({ id: BATCH_ID }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data?: {
        ingestStatus?: string;
        latestJob?: { status?: string; error?: string };
      };
    };
    expect(json.ok).toBe(true);
    expect(mocks.getLatestJobStatusForBatch).toHaveBeenCalledWith(
      "user-1",
      BATCH_ID,
      "drive_scan",
    );
    expect(json.data?.ingestStatus).toBe("failed");
    expect(json.data?.latestJob).toMatchObject({
      status: "failed",
      error: expect.stringContaining("300s"),
    });
  });
});
