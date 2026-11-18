import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueJobRecord: vi.fn(),
  getJobRecordById: vi.fn(),
  updateJobStatusRecord: vi.fn(),
  updateDriveFileExtraction: vi.fn(),
  getBatchById: vi.fn(),
  listDriveFilesForBatch: vi.fn(),
  listAssesseesByBatch: vi.fn(),
  saveSimilarityPairsForBatch: vi.fn(),
  getAssesseeById: vi.fn(),
  saveNameJuryVerdictAndOcr: vi.fn(),
  getLatestProviderConfigForAssessor: vi.fn(),
  getConfig: vi.fn(),
}));

vi.mock("@/repositories/jobs.repository", () => ({
  enqueueJobRecord: mocks.enqueueJobRecord,
  getJobRecordById: mocks.getJobRecordById,
  updateJobStatusRecord: mocks.updateJobStatusRecord,
}));

vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mocks.getBatchById,
  listDriveFilesForBatch: mocks.listDriveFilesForBatch,
  updateDriveFileExtraction: mocks.updateDriveFileExtraction,
  upsertDriveFilesForBatch: vi.fn(),
}));

vi.mock("@/repositories/assessees.repository", () => ({
  getAssesseeById: mocks.getAssesseeById,
  listAssesseesByBatch: mocks.listAssesseesByBatch,
  saveNameJuryVerdictAndOcr: mocks.saveNameJuryVerdictAndOcr,
  upsertAssesseesForBatch: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/repositories/assessment.repository", () => ({
  listDecisionsForAssessee: vi.fn(),
  listDecisionsForBatch: vi.fn().mockResolvedValue([]),
  getLatestDitAnalysis: vi.fn().mockResolvedValue(null),
  getLatestWrittenGrading: vi.fn().mockResolvedValue(null),
  getLatestInterviewAssessment: vi.fn().mockResolvedValue(null),
  upsertAiUnitRecommendations: vi.fn().mockResolvedValue(undefined),
  saveAk05ReportForBatch: vi.fn(),
  saveDitAnalysis: vi.fn(),
  saveSimilarityPairsForBatch: mocks.saveSimilarityPairsForBatch,
  saveWrittenGrading: vi.fn(),
}));

vi.mock("@/repositories/provider.repository", () => ({
  getLatestProviderConfigForAssessor: mocks.getLatestProviderConfigForAssessor,
}));

vi.mock("@/lib/config/get-config", () => ({
  getConfig: mocks.getConfig,
}));

import { runWorkerJob } from "../index";
import { enqueueJob } from "../queue";

describe("Worker dispatcher and queue runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLatestProviderConfigForAssessor.mockResolvedValue(null);
    mocks.getConfig.mockResolvedValue(null);
  });

  it("handles hello jobs cleanly", async () => {
    const res = await runWorkerJob({
      id: "job-hello-1",
      type: "hello",
      payload: { message: "ping" },
      userId: "user-1",
    });
    expect(res).toEqual({ status: "done", progress: 100 });
  });

  it("fails loudly instead of faking success on unknown job types", async () => {
    await expect(
      runWorkerJob({
        id: "job-unknown-1",
        type: "nonexistent_type",
        payload: {},
        userId: "user-1",
      }),
    ).rejects.toThrow("UNSUPPORTED_JOB_TYPE");
  });

  it("extracts raw text and persists extraction for extract_file", async () => {
    mocks.updateDriveFileExtraction.mockResolvedValue(undefined);
    const res = await runWorkerJob({
      id: "job-extract-1",
      type: "extract_file",
      userId: "user-1",
      payload: {
        fileId: "file-123",
        text: "Jawaban asesi terkait prosedur K3 laboratorium.",
      },
    });
    expect(res.status).toBe("done");
    expect(mocks.updateDriveFileExtraction).toHaveBeenCalledWith({
      userId: "user-1",
      fileId: "file-123",
      extractedText: "Jawaban asesi terkait prosedur K3 laboratorium.",
      extractionMethod: "raw_text",
    });
  });

  it("evaluates similarity_run pairs deterministically and saves flagged pairs", async () => {
    mocks.getBatchById.mockResolvedValue({
      id: "batch-1",
      lspId: "lsp-1",
      schemeId: "scheme-1",
      name: "Batch K3",
    });
    mocks.listDriveFilesForBatch.mockResolvedValue([]);
    mocks.listAssesseesByBatch.mockResolvedValue([]);
    mocks.saveSimilarityPairsForBatch.mockResolvedValue(undefined);

    const repeatedText =
      "Penerapan prosedur keselamatan dan kesehatan kerja wajib dilaksanakan sebelum pekerjaan dimulai oleh setiap pekerja";
    const res = await runWorkerJob({
      id: "job-sim-1",
      type: "similarity_run",
      userId: "user-1",
      payload: {
        batchId: "batch-1",
        submissions: [
          { assesseeId: "a-1", text: repeatedText },
          { assesseeId: "a-2", text: repeatedText },
        ],
      },
    });

    expect(res.status).toBe("done");
    expect(res.meta).toEqual({ comparedAssessees: 2, flaggedPairs: 1 });
    expect(mocks.saveSimilarityPairsForBatch).toHaveBeenCalledTimes(1);
  });

  it("runs ocr_ktp deterministic name jury and saves verdict", async () => {
    mocks.getAssesseeById.mockResolvedValue({
      id: "as-1",
      lspId: "lsp-1",
      batchId: "batch-1",
      displayName: "Budi Santoso",
      ktpNameOcr: "Budi Santoso",
      apl01Name: "Budi Santoso",
      suratTugasName: "Budi Santoso",
      ijazahName: "Budi Santoso",
    });
    mocks.saveNameJuryVerdictAndOcr.mockResolvedValue(undefined);

    const res = await runWorkerJob({
      id: "job-ocr-1",
      type: "ocr_ktp",
      userId: "user-1",
      payload: { assesseeId: "as-1", ocrConfidence: 0.96 },
    });

    expect(res.status).toBe("done");
    expect(res.meta).toEqual({ assesseeId: "as-1", verdict: "match" });
    expect(mocks.saveNameJuryVerdictAndOcr).toHaveBeenCalledTimes(1);
  });

  it("executes job inline when enqueueJob is called with default runImmediately=true", async () => {
    const baseJob = {
      id: "job-inline-1",
      createdBy: "user-1",
      type: "hello",
      status: "pending" as const,
      payload: { message: "ok" },
      progress: 0,
      error: null,
      attempts: 0,
      createdAt: "2026-11-18T00:00:00Z",
      updatedAt: "2026-11-18T00:00:00Z",
    };
    const doneJob = { ...baseJob, status: "done" as const, progress: 100, attempts: 1 };

    mocks.enqueueJobRecord.mockResolvedValue({ ok: true, job: baseJob });
    mocks.getJobRecordById
      .mockResolvedValueOnce(baseJob)
      .mockResolvedValueOnce(doneJob);
    mocks.updateJobStatusRecord.mockResolvedValue(undefined);

    const out = await enqueueJob({
      userId: "user-1",
      type: "hello",
      payload: { message: "ok" },
    });

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.job.status).toBe("done");
    }
    expect(mocks.updateJobStatusRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: "running", jobId: "job-inline-1" }),
    );
    expect(mocks.updateJobStatusRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done", progress: 100, jobId: "job-inline-1" }),
    );
  });
});
