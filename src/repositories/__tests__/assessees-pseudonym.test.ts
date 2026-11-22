import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  runRepositoryDualPath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));

vi.mock("@/db", () => ({
  isUuid: (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  runRepositoryDualPath: mocks.runRepositoryDualPath,
}));

import {
  computeNextPseudonymSeq,
  upsertAssesseesForBatch,
  type AssesseeRecord,
} from "../assessees.repository";

const BATCH_ID = "2a3f5107-61fe-48ac-9281-b42ad3c051b0";
const LSP_ID = "b03afb00-9266-467d-823e-44a7830a4077";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function makeAssessee(name: string, pseudonym: string | null): AssesseeRecord {
  return {
    id: `id-${name}`,
    lspId: LSP_ID,
    batchId: BATCH_ID,
    assignedAssessorId: USER_ID,
    displayName: name,
    pseudonym,
    nikMasked: null,
    ktpNameOcr: null,
    apl01Name: name,
    suratTugasName: null,
    ijazahName: null,
    certificateNameConfirmed: null,
    certificateNameConfirmedAt: null,
    completenessStatus: "incomplete",
    status: "pending",
  };
}

describe("computeNextPseudonymSeq & monotonic upsertAssesseesForBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runRepositoryDualPath.mockImplementation(
      async (opts: { supabase: () => Promise<unknown> }) => opts.supabase(),
    );
  });

  it("starts at 1 for an empty batch and skips past max suffix after deletions or collisions", () => {
    expect(computeNextPseudonymSeq([])).toBe(1);
    expect(
      computeNextPseudonymSeq([
        { pseudonym: "ASESI-001" },
        { pseudonym: "ASESI-003" },
      ]),
    ).toBe(4);
    expect(
      computeNextPseudonymSeq([
        { pseudonym: "ASESI-001" },
        { pseudonym: "ASESI-003" },
        { pseudonym: "ASESI-003" },
      ]),
    ).toBe(4);
    expect(computeNextPseudonymSeq([{ pseudonym: null }, { pseudonym: "CUSTOM" }])).toBe(1);
  });

  it("assigns strictly unique monotonic pseudonyms when inserting after a deletion gap", async () => {
    let insertedRows: Array<Record<string, unknown>> = [];
    const mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn((rows: Array<Record<string, unknown>>) => {
          insertedRows = rows;
          return Promise.resolve({ error: null });
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      })),
    };
    mocks.getSupabaseServerClient.mockResolvedValue(mockSupabase);

    const existingPool = [
      makeAssessee("Peserta Satu", "ASESI-001"),
      makeAssessee("Peserta Tiga", "ASESI-003"),
    ];

    await upsertAssesseesForBatch({
      userId: USER_ID,
      lspId: LSP_ID,
      batchId: BATCH_ID,
      names: ["Peserta Empat", "Peserta Lima", "Peserta Enam"],
      existingPool,
    });

    expect(insertedRows.map((r) => r.pseudonym)).toEqual([
      "ASESI-004",
      "ASESI-005",
      "ASESI-006",
    ]);
  });

  it("throws when Supabase insert fails instead of silently succeeding", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({
          error: { message: "duplicate key value violates unique constraint" },
        }),
      })),
    };
    mocks.getSupabaseServerClient.mockResolvedValue(mockSupabase);

    await expect(
      upsertAssesseesForBatch({
        userId: USER_ID,
        lspId: LSP_ID,
        batchId: BATCH_ID,
        names: ["Peserta Baru"],
        existingPool: [],
      }),
    ).rejects.toThrow("ASSESSEE_INSERT_FAILED");
  });
});
