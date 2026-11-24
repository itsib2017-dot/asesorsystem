import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireLspRole: vi.fn(),
  getAssesseeById: vi.fn(),
  getBatchById: vi.fn(),
  listDriveFilesForBatch: vi.fn(),
  listSchemes: vi.fn(),
  enqueueJob: vi.fn(),
  executeJob: vi.fn(),
  afterCallbacks: [] as Array<() => Promise<unknown> | unknown>,
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: vi.fn((cb: () => Promise<unknown> | unknown) => {
      mocks.afterCallbacks.push(cb);
    }),
  };
});

vi.mock("@/lib/auth/get-session", () => ({
  getUser: mocks.getUser,
}));

vi.mock("@/lib/auth/get-role", () => ({
  requireLspRole: mocks.requireLspRole,
}));

vi.mock("@/repositories/assessees.repository", () => ({
  getAssesseeById: mocks.getAssesseeById,
}));

vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mocks.getBatchById,
  listDriveFilesForBatch: mocks.listDriveFilesForBatch,
}));

vi.mock("@/repositories/schemes.repository", () => ({
  listSchemes: mocks.listSchemes,
}));

vi.mock("@/worker/queue", () => ({
  enqueueJob: mocks.enqueueJob,
  executeJob: mocks.executeJob,
}));

import { POST, maxDuration } from "../route";

const VALID_ASSESSEE_ID = "11111111-1111-4111-8111-111111111111";
const VALID_BATCH_ID = "22222222-2222-4222-8222-222222222222";

describe("POST /api/v1/dit/[assesseeId]/analyse (Async after() + RBAC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterCallbacks.length = 0;
    mocks.getUser.mockResolvedValue({ id: "user-1", email: "asesor@test.id" });
    mocks.requireLspRole.mockResolvedValue({ allowed: true, role: "assessor" });
    mocks.getAssesseeById.mockResolvedValue({
      id: VALID_ASSESSEE_ID,
      batchId: VALID_BATCH_ID,
      lspId: "lsp-1",
    });
    mocks.getBatchById.mockResolvedValue({
      id: VALID_BATCH_ID,
      lspId: "lsp-1",
      schemeId: "scheme-1",
    });
    mocks.listSchemes.mockResolvedValue([]);
    mocks.listDriveFilesForBatch.mockResolvedValue([]);
    mocks.executeJob.mockResolvedValue({ id: "job-dit-1", status: "done" });
  });

  it("exports maxDuration = 300 so background after() worker gets full Hobby budget", () => {
    expect(maxDuration).toBe(300);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mocks.getUser.mockResolvedValueOnce(null);
    const res = await POST(new Request("http://localhost/api/v1/dit/x/analyse", { method: "POST" }), {
      params: Promise.resolve({ assesseeId: VALID_ASSESSEE_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects unauthorized LSP roles with 403", async () => {
    mocks.requireLspRole.mockResolvedValueOnce({ allowed: false, role: "tuk_admin" });
    const res = await POST(
      new Request(`http://localhost/api/v1/dit/${VALID_ASSESSEE_ID}/analyse`, { method: "POST" }),
      { params: Promise.resolve({ assesseeId: VALID_ASSESSEE_ID }) },
    );
    expect(res.status).toBe(403);
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("rejects invalid UUID assesseeId with 404", async () => {
    const res = await POST(new Request("http://localhost/api/v1/dit/bad/analyse", { method: "POST" }), {
      params: Promise.resolve({ assesseeId: "not-a-uuid" }),
    });
    expect(res.status).toBe(404);
  });

  it("enforces metadata completeness gate (422) when neither body nor DB files exist", async () => {
    mocks.listDriveFilesForBatch.mockResolvedValueOnce([]);

    const res = await POST(
      new Request(`http://localhost/api/v1/dit/${VALID_ASSESSEE_ID}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ assesseeId: VALID_ASSESSEE_ID }) },
    );

    expect(res.status).toBe(422);
    const json = (await res.json()) as {
      ok: boolean;
      error?: { message?: string; details?: Array<{ field?: string; issue?: string }> };
    };
    expect(json.ok).toBe(false);
    expect(json.error?.message).toContain("bahan belum lengkap");
    expect(json.error?.details?.map((d) => d.field)).toEqual([
      "fr_ia_04a",
      "presentation_transcript",
      "candidate_profile",
    ]);
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("enqueues immediately (runImmediately: false) and schedules executeJob via after() when Drive files are unextracted", async () => {
    mocks.listDriveFilesForBatch.mockResolvedValueOnce([
      {
        id: "f-04a",
        assesseeId: VALID_ASSESSEE_ID,
        docType: "04a",
        fileName: "FR.IA.04A.docx",
        extractedText: null,
        driveModifiedTime: null,
      },
      {
        id: "f-04b",
        assesseeId: VALID_ASSESSEE_ID,
        docType: "04b",
        fileName: "Presentasi.pptx",
        extractedText: null,
        driveModifiedTime: null,
      },
      {
        id: "f-cv",
        assesseeId: VALID_ASSESSEE_ID,
        docType: "cv",
        fileName: "CV.pdf",
        extractedText: null,
        driveModifiedTime: null,
      },
    ]);
    mocks.enqueueJob.mockResolvedValueOnce({
      ok: true,
      job: { id: "job-dit-1", status: "pending", progress: 0, error: null },
    });

    const res = await POST(
      new Request(`http://localhost/api/v1/dit/${VALID_ASSESSEE_ID}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ assesseeId: VALID_ASSESSEE_ID }) },
    );

    expect(res.status).toBe(202);
    const json = (await res.json()) as {
      ok: boolean;
      data?: { job_id?: string; status?: string };
    };
    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({ job_id: "job-dit-1", status: "pending" });

    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        lspId: "lsp-1",
        type: "dit_analysis",
        runImmediately: false,
        payload: {
          assesseeId: VALID_ASSESSEE_ID,
          batchId: VALID_BATCH_ID,
        },
      }),
    );

    // Worker must NOT run inline before response; it runs inside after()
    expect(mocks.executeJob).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(1);
    await mocks.afterCallbacks[0]?.();
    expect(mocks.executeJob).toHaveBeenCalledWith("user-1", "job-dit-1", {
      lspId: "lsp-1",
    });
  });
});
