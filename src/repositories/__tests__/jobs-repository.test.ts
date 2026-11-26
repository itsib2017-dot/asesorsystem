import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

vi.mock("@/db", () => ({
  hasDatabaseUrl: vi.fn(() => false),
  isUuid: vi.fn((val: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
  ),
  runRepositoryDualPath: vi.fn(async ({ supabase }: { supabase: () => Promise<unknown> }) =>
    supabase(),
  ),
  withRlsTransaction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    from: mockSupabaseFrom,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: vi.fn(),
}));

import { getLatestJobForBatch } from "../jobs.repository";

const USER_ID = "00000000-0000-4000-8000-000000000010";
const BATCH_ID = "00000000-0000-4000-8000-000000000020";

describe("getLatestJobForBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores newer non-drive_scan jobs when type='drive_scan' is requested", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({
              data: [
                {
                  id: "00000000-0000-4000-8000-000000000102",
                  created_by: USER_ID,
                  type: "written_grading",
                  status: "failed",
                  payload: { batchId: BATCH_ID },
                  progress: 20,
                  error: "QUOTA_EXHAUSTED",
                  attempts: 1,
                  created_at: "2026-11-26T08:00:00Z",
                  updated_at: "2026-11-26T08:01:00Z",
                },
                {
                  id: "00000000-0000-4000-8000-000000000101",
                  created_by: USER_ID,
                  type: "drive_scan",
                  status: "done",
                  payload: { batchId: BATCH_ID },
                  progress: 100,
                  error: null,
                  attempts: 1,
                  created_at: "2026-11-26T07:00:00Z",
                  updated_at: "2026-11-26T07:01:00Z",
                },
              ],
            }),
          }),
        }),
      }),
    });

    const ingestJob = await getLatestJobForBatch(USER_ID, BATCH_ID, "drive_scan");
    expect(ingestJob?.id).toBe("00000000-0000-4000-8000-000000000101");
    expect(ingestJob?.type).toBe("drive_scan");
    expect(ingestJob?.status).toBe("done");

    const anyJob = await getLatestJobForBatch(USER_ID, BATCH_ID);
    expect(anyJob?.id).toBe("00000000-0000-4000-8000-000000000102");
    expect(anyJob?.type).toBe("written_grading");
  });

  it("returns null for non-UUID batchId", async () => {
    const res = await getLatestJobForBatch(USER_ID, "not-a-uuid", "drive_scan");
    expect(res).toBeNull();
  });
});
