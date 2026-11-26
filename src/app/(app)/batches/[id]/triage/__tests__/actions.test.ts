import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireLspRole: vi.fn(),
  getBatchById: vi.fn(),
  getAssesseeById: vi.fn(),
  listDriveFilesForBatch: vi.fn(),
  updateDriveFileTriage: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  writeAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/get-session", () => ({
  getUser: mocks.getUser,
}));

vi.mock("@/lib/auth/get-role", () => ({
  requireLspRole: mocks.requireLspRole,
  resolveAuthorizedLsp: vi.fn(),
}));

vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mocks.getBatchById,
  insertBatchRosterNote: vi.fn(),
  listDriveFilesForBatch: mocks.listDriveFilesForBatch,
  updateDriveFileTriage: mocks.updateDriveFileTriage,
}));

vi.mock("@/repositories/assessees.repository", () => ({
  getAssesseeById: mocks.getAssesseeById,
  listAssesseesByBatch: vi.fn(),
}));

vi.mock("@/repositories/provider.repository", () => ({
  getLatestProviderConfigForAssessor: vi.fn(),
}));

vi.mock("@/repositories/schemes.repository", () => ({
  getSchemeById: vi.fn(),
}));

vi.mock("@/services/drive-extract", () => ({
  reclassifyBatchFilesByContent: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

import { bulkAssignUnmatchedFilesAction } from "../actions";

const BATCH_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSEE_ID = "22222222-2222-4222-8222-222222222222";
const LSP_ID = "33333333-3333-4333-8333-333333333333";

function makeFormData(batchId = BATCH_ID, assesseeId = ASSESSEE_ID): FormData {
  const fd = new FormData();
  fd.set("batchId", batchId);
  fd.set("assesseeId", assesseeId);
  return fd;
}

describe("bulkAssignUnmatchedFilesAction (T7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: "user-1", email: "asesor@test.id" });
    mocks.getBatchById.mockResolvedValue({ id: BATCH_ID, lspId: LSP_ID });
    mocks.requireLspRole.mockResolvedValue({ allowed: true, role: "assessor" });
    mocks.getAssesseeById.mockResolvedValue({
      id: ASSESSEE_ID,
      batchId: BATCH_ID,
      displayName: "Budi Hartono",
    });
    mocks.getSupabaseServerClient.mockResolvedValue({});
    mocks.writeAuditLog.mockResolvedValue("corr-bulk-1");
    mocks.updateDriveFileTriage.mockResolvedValue(undefined);
  });

  it("ignores unauthenticated callers", async () => {
    mocks.getUser.mockResolvedValueOnce(null);
    await bulkAssignUnmatchedFilesAction(makeFormData());
    expect(mocks.updateDriveFileTriage).not.toHaveBeenCalled();
  });

  it("ignores unauthorized LSP roles", async () => {
    mocks.requireLspRole.mockResolvedValueOnce({ allowed: false, role: "viewer" });
    await bulkAssignUnmatchedFilesAction(makeFormData());
    expect(mocks.updateDriveFileTriage).not.toHaveBeenCalled();
  });

  it("rejects assessee from another batch (IDOR guard)", async () => {
    mocks.getAssesseeById.mockResolvedValueOnce({
      id: ASSESSEE_ID,
      batchId: "99999999-9999-4999-8999-999999999999",
      displayName: "Orang Lain",
    });
    await bulkAssignUnmatchedFilesAction(makeFormData());
    expect(mocks.updateDriveFileTriage).not.toHaveBeenCalled();
  });

  it("assigns unmatched candidate files (including muk_portofolio and cv) while skipping master instruments", async () => {
    mocks.listDriveFilesForBatch.mockResolvedValueOnce([
      { id: "f-cv", docType: "cv", triageStatus: "unmatched" },
      { id: "f-charter", docType: "muk_portofolio", triageStatus: "unmatched" },
      { id: "f-ktp", docType: "ktp", triageStatus: "unmatched" },
      { id: "f-st", docType: "surat_tugas", triageStatus: "unmatched" },
      { id: "f-06b", docType: "06b", triageStatus: "unmatched" },
      { id: "f-mat", docType: "materi_pelatihan", triageStatus: "unmatched" },
      { id: "f-already", docType: "apl01", triageStatus: "assigned" },
    ]);

    await bulkAssignUnmatchedFilesAction(makeFormData());

    expect(mocks.updateDriveFileTriage).toHaveBeenCalledTimes(3);
    expect(mocks.updateDriveFileTriage).toHaveBeenCalledWith({
      userId: "user-1",
      fileId: "f-cv",
      assesseeId: ASSESSEE_ID,
      triageStatus: "assigned",
    });
    expect(mocks.updateDriveFileTriage).toHaveBeenCalledWith({
      userId: "user-1",
      fileId: "f-charter",
      assesseeId: ASSESSEE_ID,
      triageStatus: "assigned",
    });
    expect(mocks.updateDriveFileTriage).toHaveBeenCalledWith({
      userId: "user-1",
      fileId: "f-ktp",
      assesseeId: ASSESSEE_ID,
      triageStatus: "assigned",
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "triage.file.bulk_assign",
        resource_id: BATCH_ID,
        after_summary: expect.objectContaining({
          assesseeId: ASSESSEE_ID,
          assignedCount: 3,
          skippedCount: 3,
        }),
      }),
      expect.anything(),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/batches/${BATCH_ID}/triage`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/batches/${BATCH_ID}`);
  });
});
