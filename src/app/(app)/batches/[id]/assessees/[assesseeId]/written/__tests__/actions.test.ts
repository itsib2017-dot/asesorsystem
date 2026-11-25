import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireLspRole: vi.fn(),
  checkRateLimit: vi.fn(),
  getBatchById: vi.fn(),
  getAssesseeById: vi.fn(),
  listDriveFilesForBatch: vi.fn(),
  saveOfficial06cAssessment: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth/get-session", () => ({
  getUser: mocks.getUser,
}));
vi.mock("@/lib/auth/get-role", () => ({
  requireLspRole: mocks.requireLspRole,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));
vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mocks.getBatchById,
  listDriveFilesForBatch: mocks.listDriveFilesForBatch,
}));
vi.mock("@/repositories/assessees.repository", () => ({
  getAssesseeById: mocks.getAssesseeById,
}));
vi.mock("@/repositories/assessment.repository", () => ({
  saveOfficial06cAssessment: mocks.saveOfficial06cAssessment,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));
vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));
vi.mock("@/lib/written/master-key", () => ({
  parseMasterKey06bFile: vi.fn(),
  persistBatchMasterKey06b: vi.fn(),
  resolveBatchActiveMasterKey: vi.fn(),
  validateMasterKey06bContent: vi.fn(),
}));
vi.mock("@/services/drive-revisions", () => ({
  pickLatestDriveFile: vi.fn(),
}));
vi.mock("@/worker/queue", () => ({
  enqueueJob: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LSP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BATCH_ID = "33333333-3333-4333-8333-333333333333";
const ASSESSEE_ID = "22222222-2222-4222-8222-222222222222";

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    fd.set(k, v);
  }
  return fd;
}

const VALID_ITEMS = JSON.stringify([
  { questionNo: 1, answerText: "HIRADC dilakukan sebelum kerja.", achieved: true, note: "Benar" },
  { questionNo: 2, answerText: "Belum lengkap.", achieved: false, note: "Perlu klarifikasi" },
]);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: USER_ID });
  mocks.requireLspRole.mockResolvedValue({ allowed: true, role: "assessor" });
  mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.getBatchById.mockResolvedValue({ id: BATCH_ID, lspId: LSP_ID });
  mocks.getAssesseeById.mockResolvedValue({
    id: ASSESSEE_ID,
    batchId: BATCH_ID,
    lspId: LSP_ID,
  });
  mocks.saveOfficial06cAssessment.mockResolvedValue(undefined);
  mocks.getSupabaseServerClient.mockResolvedValue({});
  mocks.writeAuditLog.mockResolvedValue("corr-1");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("saveIa06cAssessmentAction", () => {
  it("denies unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const { saveIa06cAssessmentAction } = await import("../actions");

    const res = await saveIa06cAssessmentAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        itemsJson: VALID_ITEMS,
        overallAchieved: "true",
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Unauthorized");
    expect(mocks.saveOfficial06cAssessment).not.toHaveBeenCalled();
  });

  it("denies unauthorized roles such as tuk_admin", async () => {
    mocks.requireLspRole.mockResolvedValue({ allowed: false, role: "tuk_admin" });
    const { saveIa06cAssessmentAction } = await import("../actions");

    const res = await saveIa06cAssessmentAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        itemsJson: VALID_ITEMS,
        overallAchieved: "true",
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    expect(mocks.saveOfficial06cAssessment).not.toHaveBeenCalled();
  });

  it("rejects malformed itemsJson payloads", async () => {
    const { saveIa06cAssessmentAction } = await import("../actions");

    const res = await saveIa06cAssessmentAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        itemsJson: "{invalid",
        overallAchieved: "true",
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak valid");
    expect(mocks.saveOfficial06cAssessment).not.toHaveBeenCalled();
  });

  it("rejects overallAchieved false (BK) without feedbackDetail", async () => {
    const { saveIa06cAssessmentAction } = await import("../actions");

    const res = await saveIa06cAssessmentAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        itemsJson: VALID_ITEMS,
        overallAchieved: "false",
        feedbackDetail: "   ",
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Catatan umpan balik wajib diisi");
    expect(mocks.saveOfficial06cAssessment).not.toHaveBeenCalled();
  });

  it("persists official06c assessment and records written.ia06c.save audit log", async () => {
    const { saveIa06cAssessmentAction } = await import("../actions");

    const res = await saveIa06cAssessmentAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        itemsJson: VALID_ITEMS,
        overallAchieved: "false",
        feedbackDetail: "Unit M.71KKK01.005.1 perlu pendalaman lisan.",
      }),
    );

    expect(res.ok).toBe(true);
    expect(mocks.saveOfficial06cAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        lspId: LSP_ID,
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        official06c: expect.objectContaining({
          overallAchieved: false,
          feedbackDetail: "Unit M.71KKK01.005.1 perlu pendalaman lisan.",
          assessedBy: USER_ID,
        }),
      }),
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        lsp_id: LSP_ID,
        actor_id: USER_ID,
        action: "written.ia06c.save",
        resource: "assessees",
        resource_id: ASSESSEE_ID,
        after_summary: expect.objectContaining({
          batchId: BATCH_ID,
          itemCount: 2,
          yaCount: 1,
          tidakCount: 1,
          belumCount: 0,
          overallAchieved: false,
        }),
      }),
      expect.anything(),
    );
  });
});
