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
  saveOfficial04bAssessment: vi.fn(),
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
}));
vi.mock("@/repositories/assessees.repository", () => ({
  getAssesseeById: mocks.getAssesseeById,
}));
vi.mock("@/repositories/assessment.repository", () => ({
  saveOfficial04bAssessment: mocks.saveOfficial04bAssessment,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));
vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog,
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
  { kpIndex: 1, no: 1, unitCode: "M.71KKK01.001.1", achieved: true, note: "Lengkap" },
  { kpIndex: 1, no: 2, unitCode: "M.71KKK01.005.1", achieved: null, note: "" },
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
  mocks.saveOfficial04bAssessment.mockResolvedValue(undefined);
  mocks.getSupabaseServerClient.mockResolvedValue({});
  mocks.writeAuditLog.mockResolvedValue("corr-1");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("saveIa04bAssessmentAction", () => {
  it("denies unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const { saveIa04bAssessmentAction } = await import("../actions");

    const res = await saveIa04bAssessmentAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        itemsJson: VALID_ITEMS,
        overallRecommendation: "K",
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Unauthorized");
    expect(mocks.saveOfficial04bAssessment).not.toHaveBeenCalled();
  });

  it("denies unauthorized roles such as tuk_admin", async () => {
    mocks.requireLspRole.mockResolvedValue({ allowed: false, role: "tuk_admin" });
    const { saveIa04bAssessmentAction } = await import("../actions");

    const res = await saveIa04bAssessmentAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        itemsJson: VALID_ITEMS,
        overallRecommendation: "K",
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    expect(mocks.saveOfficial04bAssessment).not.toHaveBeenCalled();
  });

  it("rejects overallRecommendation BK without assessorNotes", async () => {
    const { saveIa04bAssessmentAction } = await import("../actions");

    const res = await saveIa04bAssessmentAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        itemsJson: VALID_ITEMS,
        overallRecommendation: "BK",
        assessorNotes: "   ",
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Catatan asesor wajib diisi");
    expect(mocks.saveOfficial04bAssessment).not.toHaveBeenCalled();
  });

  it("persists official_04b assessment and records dit.ia04b.save audit log", async () => {
    const { saveIa04bAssessmentAction } = await import("../actions");

    const res = await saveIa04bAssessmentAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        itemsJson: VALID_ITEMS,
        overallRecommendation: "K",
        assessorNotes: "Memenuhi observasi aspek 1.",
      }),
    );

    expect(res.ok).toBe(true);
    expect(mocks.saveOfficial04bAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        lspId: LSP_ID,
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        official04b: expect.objectContaining({
          overallRecommendation: "K",
          assessorNotes: "Memenuhi observasi aspek 1.",
          assessedBy: USER_ID,
        }),
      }),
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        lsp_id: LSP_ID,
        actor_id: USER_ID,
        action: "dit.ia04b.save",
        resource: "assessees",
        resource_id: ASSESSEE_ID,
        after_summary: expect.objectContaining({
          batchId: BATCH_ID,
          itemCount: 2,
          yaCount: 1,
          tidakCount: 0,
          overallRecommendation: "K",
        }),
      }),
      expect.anything(),
    );
  });
});
