import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAssesseeById: vi.fn(),
  listDriveFilesForBatch: vi.fn(),
  getLatestProviderConfigForAssessor: vi.fn(),
  resolveAssesseeDitInputs: vi.fn(),
  enqueueJob: vi.fn(),
}));

vi.mock("@/lib/auth/get-session", () => ({
  getUser: mocks.getUser,
}));

vi.mock("@/repositories/assessees.repository", () => ({
  getAssesseeById: mocks.getAssesseeById,
}));

vi.mock("@/repositories/batches.repository", () => ({
  listDriveFilesForBatch: mocks.listDriveFilesForBatch,
}));

vi.mock("@/repositories/provider.repository", () => ({
  getLatestProviderConfigForAssessor: mocks.getLatestProviderConfigForAssessor,
}));

vi.mock("@/services/drive-extract", () => ({
  resolveAssesseeDitInputs: mocks.resolveAssesseeDitInputs,
}));

vi.mock("@/worker/queue", () => ({
  enqueueJob: mocks.enqueueJob,
}));

import { POST } from "../route";

const VALID_ASSESSEE_ID = "11111111-1111-4111-8111-111111111111";
const VALID_BATCH_ID = "22222222-2222-4222-8222-222222222222";

describe("POST /api/v1/dit/[assesseeId]/analyse (T3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: "user-1", email: "asesor@test.id" });
    mocks.getAssesseeById.mockResolvedValue({
      id: VALID_ASSESSEE_ID,
      batchId: VALID_BATCH_ID,
      lspId: "lsp-1",
    });
    mocks.getLatestProviderConfigForAssessor.mockResolvedValue(null);
    mocks.listDriveFilesForBatch.mockResolvedValue([]);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mocks.getUser.mockResolvedValueOnce(null);
    const res = await POST(new Request("http://localhost/api/v1/dit/x/analyse", { method: "POST" }), {
      params: Promise.resolve({ assesseeId: VALID_ASSESSEE_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects invalid UUID assesseeId with 404", async () => {
    const res = await POST(new Request("http://localhost/api/v1/dit/bad/analyse", { method: "POST" }), {
      params: Promise.resolve({ assesseeId: "not-a-uuid" }),
    });
    expect(res.status).toBe(404);
  });

  it("enforces completeness gate (422) when both body and DB files are incomplete", async () => {
    mocks.resolveAssesseeDitInputs.mockResolvedValueOnce({
      frIa04aText: "",
      presentationTranscript: "",
      candidateProfileSummary: "",
      extractionErrors: ["CV (cv.pdf): scan image only"],
    });

    const res = await POST(
      new Request(`http://localhost/api/v1/dit/${VALID_ASSESSEE_ID}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ assesseeId: VALID_ASSESSEE_ID }) },
    );

    expect(res.status).toBe(422);
    const json = (await res.json()) as { ok: boolean; error?: { message?: string } };
    expect(json.ok).toBe(false);
    expect(json.error?.message).toContain("scan image only");
  });

  it("resolves DB inputs on demand and enqueues dit_analysis on empty POST body", async () => {
    mocks.resolveAssesseeDitInputs.mockResolvedValueOnce({
      frIa04aText: "Instruksi Terstruktur Proyek K3 lengkap minimal sepuluh karakter.",
      presentationTranscript: "Slide presentasi identifikasi bahaya dan pengendalian risiko K3.",
      candidateProfileSummary: "Pengalaman HSE officer 3 tahun di manufaktur.",
      extractionErrors: [],
    });
    mocks.enqueueJob.mockResolvedValueOnce({
      ok: true,
      job: { id: "job-dit-1", status: "done", progress: 100, error: null },
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
    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "dit_analysis",
        payload: expect.objectContaining({
          assesseeId: VALID_ASSESSEE_ID,
          batchId: VALID_BATCH_ID,
        }),
      }),
    );
  });
});
