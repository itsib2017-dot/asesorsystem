import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireLspRole: vi.fn(),
  getBatchById: vi.fn(),
  listAssesseesByBatch: vi.fn(),
  getAssesseeById: vi.fn(),
  upsertAssesseesForBatch: vi.fn(),
  updateAssesseeDisplayName: vi.fn(),
  deleteAssesseeForBatch: vi.fn(),
  writeAuditLog: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  extractGoogleSheetId: vi.fn(),
  parseKelompokAsesiCsv: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/get-session", () => ({
  getUser: mocks.getUser,
}));
vi.mock("@/lib/auth/get-role", () => ({
  requireLspRole: mocks.requireLspRole,
}));
vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mocks.getBatchById,
}));
vi.mock("@/repositories/assessees.repository", () => ({
  listAssesseesByBatch: mocks.listAssesseesByBatch,
  getAssesseeById: mocks.getAssesseeById,
  upsertAssesseesForBatch: mocks.upsertAssesseesForBatch,
  updateAssesseeDisplayName: mocks.updateAssesseeDisplayName,
  deleteAssesseeForBatch: mocks.deleteAssesseeForBatch,
}));
vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));
vi.mock("@/services/drive", () => ({
  extractGoogleSheetId: mocks.extractGoogleSheetId,
  parseKelompokAsesiCsv: mocks.parseKelompokAsesiCsv,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

const BATCH_ID = "c61cf7c5-dd98-418b-85b7-9690caf1bdb2";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSEE_ID = "22222222-2222-4222-8222-222222222222";

const makeFormData = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: USER_ID } as unknown as { id: string });
  mocks.requireLspRole.mockResolvedValue({ allowed: true, role: "assessor" as const });
  mocks.getBatchById.mockResolvedValue({
    id: BATCH_ID,
    lspId: "lsp-1",
    schemeId: "scheme-1",
  } as unknown as { id: string; lspId: string; schemeId: string });
  mocks.listAssesseesByBatch.mockResolvedValue([]);
  mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.writeAuditLog.mockResolvedValue("corr-1");
  mocks.getSupabaseServerClient.mockReturnValue(
    {} as unknown as ReturnType<typeof import("@/lib/supabase/server").getSupabaseServerClient>,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("addAssesseeAction", () => {
  it("adds a new assessee and returns its id", async () => {
    const { addAssesseeAction } = await import("../roster-actions");
    mocks.upsertAssesseesForBatch.mockResolvedValue([
      { id: ASSESSEE_ID, displayName: "Budi Santoso", lspId: "lsp-1", batchId: BATCH_ID },
    ]);

    const res = await addAssesseeAction(
      makeFormData({ batchId: BATCH_ID, displayName: "Budi Santoso" }),
    );

    expect(res.ok).toBe(true);
    expect(res.assesseeId).toBe(ASSESSEE_ID);
    expect(mocks.upsertAssesseesForBatch).toHaveBeenCalledWith({
      userId: USER_ID,
      lspId: "lsp-1",
      batchId: BATCH_ID,
      names: ["Budi Santoso"],
      existingPool: [],
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "batch.roster.add" }),
      expect.anything(),
    );
  });

  it("rejects duplicate name", async () => {
    const { addAssesseeAction } = await import("../roster-actions");
    mocks.listAssesseesByBatch.mockResolvedValue([
      { id: ASSESSEE_ID, displayName: "Budi Santoso" },
    ]);

    const res = await addAssesseeAction(
      makeFormData({ batchId: BATCH_ID, displayName: "Budi Santoso" }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("sudah ada");
  });

  it("rejects unauthorized user", async () => {
    const { addAssesseeAction } = await import("../roster-actions");
    mocks.requireLspRole.mockResolvedValue({ allowed: false, role: null });

    const res = await addAssesseeAction(
      makeFormData({ batchId: BATCH_ID, displayName: "Budi Santoso" }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
  });
});

describe("updateAssesseeAction", () => {
  it("updates an unconfirmed assessee name", async () => {
    const { updateAssesseeAction } = await import("../roster-actions");
    mocks.getAssesseeById.mockResolvedValue({
      id: ASSESSEE_ID,
      batchId: BATCH_ID,
      displayName: "Budi Santoso",
      certificateNameConfirmed: null,
    });
    mocks.updateAssesseeDisplayName.mockResolvedValue(undefined);

    const res = await updateAssesseeAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        displayName: "Budi Santoso Baru",
      }),
    );

    expect(res.ok).toBe(true);
    expect(res.displayName).toBe("Budi Santoso Baru");
    expect(mocks.updateAssesseeDisplayName).toHaveBeenCalledWith({
      userId: USER_ID,
      assesseeId: ASSESSEE_ID,
      displayName: "Budi Santoso Baru",
    });
  });

  it("rejects updating confirmed certificate name", async () => {
    const { updateAssesseeAction } = await import("../roster-actions");
    mocks.getAssesseeById.mockResolvedValue({
      id: ASSESSEE_ID,
      batchId: BATCH_ID,
      displayName: "Budi Santoso",
      certificateNameConfirmed: "Budi Santoso",
    });

    const res = await updateAssesseeAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        displayName: "Budi Baru",
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("dikonfirmasi");
  });
});

describe("deleteAssesseeAction", () => {
  it("deletes an unconfirmed assessee with no links", async () => {
    const { deleteAssesseeAction } = await import("../roster-actions");
    mocks.getAssesseeById.mockResolvedValue({
      id: ASSESSEE_ID,
      batchId: BATCH_ID,
      displayName: "Budi Santoso",
      certificateNameConfirmed: null,
    });
    mocks.deleteAssesseeForBatch.mockResolvedValue({
      ok: true,
      displayName: "Budi Santoso",
    });

    const res = await deleteAssesseeAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID }),
    );

    expect(res.ok).toBe(true);
    expect(res.displayName).toBe("Budi Santoso");
    expect(mocks.deleteAssesseeForBatch).toHaveBeenCalledWith({
      userId: USER_ID,
      assesseeId: ASSESSEE_ID,
      batchId: BATCH_ID,
    });
  });

  it("rejects deleting confirmed assessee", async () => {
    const { deleteAssesseeAction } = await import("../roster-actions");
    mocks.getAssesseeById.mockResolvedValue({
      id: ASSESSEE_ID,
      batchId: BATCH_ID,
      displayName: "Budi Santoso",
      certificateNameConfirmed: "Budi Santoso",
    });

    const res = await deleteAssesseeAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("dikonfirmasi");
  });
});

describe("importRosterFromSheetAction", () => {
  it("imports names from Google Sheet CSV", async () => {
    const { importRosterFromSheetAction } = await import("../roster-actions");
    mocks.extractGoogleSheetId.mockReturnValue("sheet-123");
    mocks.parseKelompokAsesiCsv.mockReturnValue([
      { groupName: "Grup 1", assesseeNames: ["Budi Santoso", "Siti Rahayu"] },
    ]);
    mocks.listAssesseesByBatch.mockResolvedValue([]);
    mocks.upsertAssesseesForBatch.mockResolvedValue([
      { id: ASSESSEE_ID, displayName: "Budi Santoso" },
      { id: "33333333-3333-4333-8333-333333333333", displayName: "Siti Rahayu" },
    ]);

    // Mock fetch for CSV export
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("Nama Kelompok,Nama Asesi\nGrup 1,\"Budi Santoso;Siti Rahayu\"", { status: 200 }));

    const res = await importRosterFromSheetAction(
      makeFormData({
        batchId: BATCH_ID,
        kelompokSheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123",
      }),
    );

    expect(res.ok).toBe(true);
    expect(res.importedCount).toBe(2);
    expect(mocks.upsertAssesseesForBatch).toHaveBeenCalledWith({
      userId: USER_ID,
      lspId: "lsp-1",
      batchId: BATCH_ID,
      names: ["Budi Santoso", "Siti Rahayu"],
      existingPool: [],
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "batch.roster.import" }),
      expect.anything(),
    );
    fetchMock.mockRestore();
  });

  it("rejects invalid sheet URL", async () => {
    const { importRosterFromSheetAction } = await import("../roster-actions");
    mocks.extractGoogleSheetId.mockReturnValue(null);

    const res = await importRosterFromSheetAction(
      makeFormData({
        batchId: BATCH_ID,
        kelompokSheetUrl: "https://example.com/not-a-sheet",
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("ID Google Sheet");
  });
});
