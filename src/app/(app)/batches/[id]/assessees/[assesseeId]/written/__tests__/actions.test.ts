import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  afterCallbacks: [] as Array<() => Promise<void> | void>,
  getUser: vi.fn(),
  requireLspRole: vi.fn(),
  checkRateLimit: vi.fn(),
  getBatchById: vi.fn(),
  getAssesseeById: vi.fn(),
  listDriveFilesForBatch: vi.fn(),
  saveOfficial06cAssessment: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  writeAuditLog: vi.fn(),
  parseMasterKey06bFile: vi.fn(),
  persistBatchMasterKey06b: vi.fn(),
  resolveBatchActiveMasterKey: vi.fn(),
  validateMasterKey06bContent: vi.fn(),
  pickLatestDriveFile: vi.fn(),
  enqueueJob: vi.fn(),
  executeJob: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: (cb: () => Promise<void> | void) => {
    mocks.after(cb);
    mocks.afterCallbacks.push(cb);
  },
}));
vi.mock("@/lib/logger", () => ({
  logEvent: mocks.logEvent,
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
  parseMasterKey06bFile: mocks.parseMasterKey06bFile,
  persistBatchMasterKey06b: mocks.persistBatchMasterKey06b,
  resolveBatchActiveMasterKey: mocks.resolveBatchActiveMasterKey,
  validateMasterKey06bContent: mocks.validateMasterKey06bContent,
}));
vi.mock("@/services/drive-revisions", () => ({
  pickLatestDriveFile: mocks.pickLatestDriveFile,
}));
vi.mock("@/worker/queue", () => ({
  enqueueJob: mocks.enqueueJob,
  executeJob: mocks.executeJob,
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
  mocks.afterCallbacks.length = 0;
  mocks.getUser.mockResolvedValue({ id: USER_ID });
  mocks.requireLspRole.mockResolvedValue({ allowed: true, role: "assessor" });
  mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.getBatchById.mockResolvedValue({ id: BATCH_ID, lspId: LSP_ID });
  mocks.getAssesseeById.mockResolvedValue({
    id: ASSESSEE_ID,
    batchId: BATCH_ID,
    lspId: LSP_ID,
  });
  mocks.listDriveFilesForBatch.mockResolvedValue([]);
  mocks.pickLatestDriveFile.mockReturnValue(null);
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

describe("saveWrittenMasterKeyAction", () => {
  it("denies unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const { saveWrittenMasterKeyAction } = await import("../actions");

    const res = await saveWrittenMasterKeyAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID, masterKeyText: "Kunci 06B" }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Unauthorized");
    expect(mocks.persistBatchMasterKey06b).not.toHaveBeenCalled();
  });

  it("denies unauthorized roles such as tuk_admin", async () => {
    mocks.requireLspRole.mockResolvedValue({ allowed: false, role: "tuk_admin" });
    const { saveWrittenMasterKeyAction } = await import("../actions");

    const res = await saveWrittenMasterKeyAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID, masterKeyText: "Kunci 06B" }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    expect(mocks.persistBatchMasterKey06b).not.toHaveBeenCalled();
  });

  it("rejects assessee belonging to a different batch (IDOR check)", async () => {
    mocks.getAssesseeById.mockResolvedValue({
      id: ASSESSEE_ID,
      batchId: "99999999-9999-4999-8999-999999999999",
      lspId: LSP_ID,
    });
    const { saveWrittenMasterKeyAction } = await import("../actions");

    const res = await saveWrittenMasterKeyAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID, masterKeyText: "Kunci 06B" }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("akses ditolak");
    expect(mocks.persistBatchMasterKey06b).not.toHaveBeenCalled();
  });

  it("rejects when neither file nor key text is provided", async () => {
    const { saveWrittenMasterKeyAction } = await import("../actions");

    const res = await saveWrittenMasterKeyAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID, masterKeyText: "   " }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Unggah berkas kunci 06B");
    expect(mocks.persistBatchMasterKey06b).not.toHaveBeenCalled();
  });

  it("validates and persists manual master key text without enqueuing grading", async () => {
    mocks.validateMasterKey06bContent.mockReturnValue({
      valid: true,
      status: "valid",
      summary: "Lolos validasi isi: 315 kata",
    });
    mocks.persistBatchMasterKey06b.mockResolvedValue({
      ok: true,
      fileId: "file-06b",
      validation: { valid: true, status: "valid", summary: "Lolos validasi isi: 315 kata" },
    });

    const { saveWrittenMasterKeyAction } = await import("../actions");
    const res = await saveWrittenMasterKeyAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        masterKeyText: "Kunci jawaban 06B lengkap lebih dari minimal kata.",
      }),
    );

    expect(res.ok).toBe(true);
    expect(res.fileName).toBe("FR.IA.06B_Kunci_Manual.txt");
    expect(res.validationSummary).toContain("315 kata");
    expect(mocks.persistBatchMasterKey06b).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });
});

describe("runWrittenGradingWithKeyAction", () => {
  it("denies unauthenticated users, unauthorized roles, and rate-limited callers", async () => {
    const { runWrittenGradingWithKeyAction } = await import("../actions");

    mocks.getUser.mockResolvedValueOnce(null);
    const r1 = await runWrittenGradingWithKeyAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID }),
    );
    expect(r1.ok).toBe(false);
    expect(r1.error).toContain("Unauthorized");

    mocks.requireLspRole.mockResolvedValueOnce({ allowed: false, role: "tuk_admin" });
    const r2 = await runWrittenGradingWithKeyAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID }),
    );
    expect(r2.ok).toBe(false);
    expect(r2.error).toContain("Akses ditolak");

    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 45 });
    const r3 = await runWrittenGradingWithKeyAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID }),
    );
    expect(r3.ok).toBe(false);
    expect(r3.error).toContain("45 detik");
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("blocks when no active valid master key exists on the batch", async () => {
    mocks.resolveBatchActiveMasterKey.mockReturnValue({
      isReadyForGrading: false,
      activeFile: null,
      blockingWarning: "Belum ada kunci 06B aktif.",
    });

    const { runWrittenGradingWithKeyAction } = await import("../actions");
    const res = await runWrittenGradingWithKeyAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Belum ada kunci 06B aktif");
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("enqueues asynchronously with runImmediately=false and triggers executeJob via after()", async () => {
    const jobId = "77777777-7777-4777-8777-777777777777";
    mocks.resolveBatchActiveMasterKey.mockReturnValue({
      isReadyForGrading: true,
      activeFile: { id: "file-1", extractedText: "Kunci aktif valid lengkap." },
    });
    mocks.validateMasterKey06bContent.mockReturnValue({
      valid: true,
      status: "valid",
      summary: "Lolos validasi",
    });
    mocks.enqueueJob.mockResolvedValue({
      ok: true,
      job: { id: jobId, status: "pending", progress: 0 },
    });
    mocks.executeJob.mockResolvedValue({ id: jobId, status: "done", progress: 100 });

    const { runWrittenGradingWithKeyAction } = await import("../actions");
    const res = await runWrittenGradingWithKeyAction(
      makeFormData({
        batchId: BATCH_ID,
        assesseeId: ASSESSEE_ID,
        studentAnswerText: "Jawaban asesi 06C",
      }),
    );

    expect(res.ok).toBe(true);
    expect(res.jobId).toBe(jobId);
    expect(res.status).toBe("pending");
    expect(res.progress).toBe(0);
    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        lspId: LSP_ID,
        type: "written_grading",
        runImmediately: false,
        payload: expect.objectContaining({
          batchId: BATCH_ID,
          assesseeId: ASSESSEE_ID,
          masterKeyText: "Kunci aktif valid lengkap.",
          studentAnswerText: "Jawaban asesi 06C",
        }),
      }),
    );
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.executeJob).not.toHaveBeenCalled();

    await mocks.afterCallbacks[0]!();
    expect(mocks.executeJob).toHaveBeenCalledWith(USER_ID, jobId, { lspId: LSP_ID });
  });
});
