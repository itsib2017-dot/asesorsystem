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
  getSupabaseServerClient: vi.fn(),
  writeAuditLog: vi.fn(),
  listUserMemberships: vi.fn(),
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

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/repositories/auth.repository", () => ({
  listUserMemberships: mocks.listUserMemberships,
}));

import { runWorkerJob } from "../index";
import { enqueueJob, executeJob } from "../queue";

describe("Worker dispatcher and queue runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLatestProviderConfigForAssessor.mockResolvedValue(null);
    mocks.getConfig.mockResolvedValue(null);
    mocks.getSupabaseServerClient.mockResolvedValue({});
    mocks.writeAuditLog.mockResolvedValue("corr-1");
    mocks.listUserMemberships.mockResolvedValue([]);
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
      type: "extract_file",
      status: "pending" as const,
      payload: { fileId: "file-inline-1", text: "Isi teks uji inline" },
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
    mocks.updateDriveFileExtraction.mockResolvedValue(undefined);

    const out = await enqueueJob({
      userId: "user-1",
      type: "extract_file",
      payload: { fileId: "file-inline-1", text: "Isi teks uji inline" },
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

  it("records created, rescan, started, completed, retried, and failed job audit events with batch lsp_id", async () => {
    const batchId = "f98e5671-fbcb-42cb-a724-9f69d24f780b";
    const jobId = "b629abf7-84a2-4ece-b755-0ffe24ef841b";
    const lspId = "b03afb00-9266-467d-823e-44a7830a4077";

    const pendingJob = {
      id: jobId,
      createdBy: "user-1",
      type: "extract_file",
      status: "pending" as const,
      payload: { batchId, fileId: "file-1", text: "Isi teks uji audit" },
      progress: 0,
      error: null,
      attempts: 0,
      createdAt: "2026-11-19T00:00:00Z",
      updatedAt: "2026-11-19T00:00:00Z",
    };
    const doneJob = { ...pendingJob, status: "done" as const, progress: 100, attempts: 1 };

    mocks.getBatchById.mockResolvedValue({ id: batchId, lspId, schemeId: "s-1", name: "Demo" });
    mocks.enqueueJobRecord.mockResolvedValue({ ok: true, job: pendingJob });
    mocks.getJobRecordById
      .mockResolvedValueOnce(pendingJob)
      .mockResolvedValueOnce(doneJob)
      .mockResolvedValueOnce(doneJob)
      .mockResolvedValueOnce({ ...doneJob, status: "failed", progress: 0, error: "boom", attempts: 2 });
    mocks.updateJobStatusRecord.mockResolvedValue(undefined);
    mocks.updateDriveFileExtraction.mockResolvedValue(undefined);

    await enqueueJob({
      userId: "user-1",
      type: "extract_file",
      triggerAction: "rescan",
      payload: { batchId, fileId: "file-1", text: "Isi teks uji audit", driveFolderUrl: "https://drive.google.com/drive/folders/abc" },
    });

    const recordedActions = mocks.writeAuditLog.mock.calls.map((c) => c[0]?.action);
    expect(recordedActions).toEqual([
      "job.extract_file.created",
      "job.extract_file.rescan",
      "job.extract_file.started",
      "job.extract_file.completed",
    ]);
    for (const call of mocks.writeAuditLog.mock.calls) {
      expect(call[0]).toMatchObject({
        lsp_id: lspId,
        resource: "jobs",
        resource_id: jobId,
        after_summary: expect.objectContaining({ batchId, type: "extract_file" }),
      });
    }

    mocks.writeAuditLog.mockClear();
    mocks.updateDriveFileExtraction.mockRejectedValueOnce(new Error("db write boom"));

    await executeJob("user-1", jobId, { triggerAction: "retry" });
    const retryActions = mocks.writeAuditLog.mock.calls.map((c) => c[0]?.action);
    expect(retryActions).toEqual([
      "job.extract_file.retried",
      "job.extract_file.started",
      "job.extract_file.failed",
    ]);
    expect(mocks.writeAuditLog.mock.calls[2]?.[0]).toMatchObject({
      lsp_id: lspId,
      resource: "jobs",
      resource_id: jobId,
      after_summary: expect.objectContaining({ status: "failed", error: "db write boom" }),
    });
  });
});
