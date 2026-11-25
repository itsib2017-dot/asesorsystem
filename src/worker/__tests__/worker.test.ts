import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueJobRecord: vi.fn(),
  getJobRecordById: vi.fn(),
  updateJobStatusRecord: vi.fn(),
  updateDriveFileExtraction: vi.fn(),
  updateDriveFileClassification: vi.fn(),
  upsertDriveFilesForBatch: vi.fn(),
  getDriveFileByDriveFileId: vi.fn(),
  setBatchActiveMasterKey: vi.fn(),
  clearBatchActiveMasterKey: vi.fn(),
  updateBatchMetadata: vi.fn(),
  getBatchById: vi.fn(),
  getDriveFileById: vi.fn(),
  listDriveFilesForBatch: vi.fn(),
  listAssesseesByBatch: vi.fn(),
  upsertAssesseesForBatch: vi.fn(),
  updateAssesseeDisplayName: vi.fn(),
  pruneOrphanedDuplicateAssessees: vi.fn(),
  saveSimilarityPairsForBatch: vi.fn(),
  getAssesseeById: vi.fn(),
  saveNameJuryVerdictAndOcr: vi.fn(),
  getLatestProviderConfigForAssessor: vi.fn(),
  getConfig: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  writeAuditLog: vi.fn(),
  listUserMemberships: vi.fn(),
  listSchemes: vi.fn(),
}));

vi.mock("@/repositories/jobs.repository", () => ({
  enqueueJobRecord: mocks.enqueueJobRecord,
  getJobRecordById: mocks.getJobRecordById,
  updateJobStatusRecord: mocks.updateJobStatusRecord,
}));

vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mocks.getBatchById,
  getDriveFileById: mocks.getDriveFileById,
  getDriveFileByDriveFileId: mocks.getDriveFileByDriveFileId,
  listDriveFilesForBatch: mocks.listDriveFilesForBatch,
  setBatchActiveMasterKey: mocks.setBatchActiveMasterKey,
  clearBatchActiveMasterKey: mocks.clearBatchActiveMasterKey,
  updateBatchMetadata: mocks.updateBatchMetadata,
  updateDriveFileExtraction: mocks.updateDriveFileExtraction,
  updateDriveFileClassification: mocks.updateDriveFileClassification,
  upsertDriveFilesForBatch: mocks.upsertDriveFilesForBatch,
}));

vi.mock("@/repositories/assessees.repository", () => ({
  getAssesseeById: mocks.getAssesseeById,
  listAssesseesByBatch: mocks.listAssesseesByBatch,
  saveNameJuryVerdictAndOcr: mocks.saveNameJuryVerdictAndOcr,
  updateAssesseeDisplayName: mocks.updateAssesseeDisplayName,
  upsertAssesseesForBatch: mocks.upsertAssesseesForBatch,
  pruneOrphanedDuplicateAssessees: mocks.pruneOrphanedDuplicateAssessees,
}));

vi.mock("@/repositories/assessment.repository", () => ({
  listDecisionsForAssessee: vi.fn(),
  listDecisionsForBatch: vi.fn().mockResolvedValue([]),
  listDitAnalysesForBatch: vi.fn().mockResolvedValue([]),
  listWrittenGradingsForBatch: vi.fn().mockResolvedValue([]),
  listInterviewAssessmentsForBatch: vi.fn().mockResolvedValue([]),
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

vi.mock("@/repositories/schemes.repository", () => ({
  listSchemes: mocks.listSchemes,
}));

import JSZip from "jszip";
import * as assessmentRepo from "@/repositories/assessment.repository";
import * as encryption from "@/lib/crypto/encryption";
import * as gradingService from "@/services/grading";
import { runWorkerJob } from "../index";
import { enqueueJob, executeJob } from "../queue";
import { STALE_RUNNING_MS, isStaleRunningJob } from "../job-staleness";

describe("Worker dispatcher and queue runner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.getLatestProviderConfigForAssessor.mockResolvedValue(null);
    mocks.getConfig.mockResolvedValue(null);
    mocks.getSupabaseServerClient.mockResolvedValue({});
    mocks.writeAuditLog.mockResolvedValue("corr-1");
    mocks.listUserMemberships.mockResolvedValue([]);
    mocks.listSchemes.mockResolvedValue([]);
    mocks.updateAssesseeDisplayName.mockResolvedValue(undefined);
    mocks.upsertAssesseesForBatch.mockResolvedValue([]);
    mocks.upsertDriveFilesForBatch.mockResolvedValue(0);
    mocks.pruneOrphanedDuplicateAssessees.mockResolvedValue([]);
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

  it("performs two-pass authoritative roster merge, unpacks ZIPs, assigns DIT variants, and prunes duplicate assessees on drive_scan (R8)", async () => {
    const batchId = "f98e5671-fbcb-42cb-a724-9f69d24f780b";
    const lspId = "b03afb00-9266-467d-823e-44a7830a4077";

    mocks.getBatchById.mockResolvedValue({
      id: batchId,
      lspId,
      schemeId: "scheme-1",
      name: "Demo Audit R4",
      driveFolderUrl: "https://drive.google.com/drive/folders/rootfolder123",
    });
    mocks.listDriveFilesForBatch.mockResolvedValue([]);

    const canonicalList = [
      { id: "as-bagas", displayName: "Bagas Priambodo", certificateNameConfirmed: null },
      { id: "as-suanggi", displayName: "Suanggi Pratama", certificateNameConfirmed: null },
      { id: "as-fara", displayName: "Faradhila Aushafiana Manaf", certificateNameConfirmed: null },
    ];
    const staleAndCanonicalBefore = [
      ...canonicalList,
      { id: "as-dup-bagas", displayName: "BAGAS K3", certificateNameConfirmed: null },
      { id: "as-dup-suangi", displayName: "TUGAS SUANGI", certificateNameConfirmed: null },
    ];

    mocks.listAssesseesByBatch
      .mockResolvedValueOnce(staleAndCanonicalBefore)
      .mockResolvedValueOnce([...staleAndCanonicalBefore]);
    mocks.upsertAssesseesForBatch.mockResolvedValue(canonicalList);
    mocks.upsertDriveFilesForBatch.mockImplementation(async (args: { files: unknown[] }) => args.files.length);
    mocks.pruneOrphanedDuplicateAssessees.mockResolvedValue([
      { id: "as-dup-bagas", displayName: "BAGAS K3" },
      { id: "as-dup-suangi", displayName: "TUGAS SUANGI" },
    ]);

    const zip = new JSZip();
    zip.file("Persyaratan/1. Bagas Priambodo/2. Form ERP.txt", "Prosedur Tanggap Darurat Kebakaran");
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const htmlPage = (entries: Array<{ id: string; title: string; isFolder?: boolean }>) =>
      entries
        .map(
          (e) => `
          <div class="flip-entry" id="entry-${e.id}">
            <a href="${e.isFolder ? `https://drive.google.com/drive/folders/${e.id}` : `https://drive.google.com/file/d/${e.id}/view`}">
              <div class="flip-entry-title">${e.title}</div>
            </a>
          </div>`,
        )
        .join("\n");

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const parsedUrl = new URL(String(input));
      const fid = parsedUrl.searchParams.get("id");
      if (fid === "rootfolder123") {
        return new Response(
          htmlPage([
            { id: "f-req", title: "Persyaratan", isFolder: true },
            { id: "f-dit", title: "Tugas DIT", isFolder: true },
            { id: "zip12345678", title: "Bundle.zip" },
          ]),
          { status: 200 },
        );
      }
      if (fid === "f-req") {
        return new Response(
          htmlPage([
            { id: "f-b", title: "1. Bagas Priambodo", isFolder: true },
            { id: "f-s", title: "2. Suanggi Pratama", isFolder: true },
            { id: "f-f", title: "3. Faradhila Aushafiana Manaf", isFolder: true },
          ]),
          { status: 200 },
        );
      }
      if (fid === "f-b") {
        return new Response(htmlPage([{ id: "ktp-bagas-1", title: "KTP Bagas.jpg" }]), { status: 200 });
      }
      if (fid === "f-s") {
        return new Response(htmlPage([{ id: "cv-suanggi-1", title: "CV Suanggi.jpg" }]), { status: 200 });
      }
      if (fid === "f-f") {
        return new Response(htmlPage([{ id: "ktp-fara-1", title: "KTP Faradhila.jpg" }]), { status: 200 });
      }
      if (fid === "f-dit") {
        return new Response(
          htmlPage([
            { id: "f-dit-bagas", title: "BAGAS K3", isFolder: true },
            { id: "f-dit-suangi", title: "TUGAS SUANGI", isFolder: true },
            { id: "dit-fara-ppt", title: "DIT_Faradhila A.Manaf.ppt" },
          ]),
          { status: 200 },
        );
      }
      if (fid === "f-dit-bagas") {
        return new Response(htmlPage([{ id: "ibpr-bagas-1", title: "1. Form IBPR.jpg" }]), { status: 200 });
      }
      if (fid === "f-dit-suangi") {
        return new Response(htmlPage([{ id: "ppt-suangi-1", title: "Paparan.jpg" }]), { status: 200 });
      }
      if (fid === "zip12345678") {
        return new Response(new Uint8Array(zipBuffer), {
          status: 200,
          headers: { "content-type": "application/zip" },
        });
      }
      return new Response("Not Found", { status: 404 });
    });

    const out = await runWorkerJob({
      id: "job-scan-r8",
      type: "drive_scan",
      userId: "user-1",
      payload: { batchId },
    });

    expect(out.status).toBe("done");
    expect(out.meta).toMatchObject({
      discoveredAssessees: 3,
      prunedDuplicateAssessees: 2,
    });
    expect(mocks.upsertAssesseesForBatch).toHaveBeenCalledTimes(1);
    expect(mocks.upsertAssesseesForBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        names: ["Bagas Priambodo", "Suanggi Pratama", "Faradhila Aushafiana Manaf"],
      }),
    );

    const savedPayload = mocks.upsertDriveFilesForBatch.mock.calls[0]?.[0] as {
      files: Array<{ fileName: string; assesseeId: string | null; docType: string }>;
    };
    const ibpr = savedPayload.files.find((f) => f.fileName === "1. Form IBPR.jpg");
    const erpZipChild = savedPayload.files.find((f) => f.fileName === "2. Form ERP.txt");
    const faraDit = savedPayload.files.find((f) => f.fileName === "DIT_Faradhila A.Manaf.ppt");
    const suangiDit = savedPayload.files.find((f) => f.fileName === "Paparan.jpg");

    expect(ibpr).toMatchObject({ assesseeId: "as-bagas", docType: "dit_form" });
    expect(erpZipChild).toMatchObject({ assesseeId: "as-bagas", docType: "dit_form" });
    expect(faraDit).toMatchObject({ assesseeId: "as-fara", docType: "04b" });
    expect(suangiDit?.assesseeId).toBe("as-suanggi");
    expect(mocks.pruneOrphanedDuplicateAssessees).toHaveBeenCalledWith({
      userId: "user-1",
      batchId,
    });
  });

  it("picks the newest revision of FR.IA.06C during similarity_run", async () => {
    mocks.getBatchById.mockResolvedValue({
      id: "batch-sim",
      lspId: "lsp-1",
      schemeId: "scheme-1",
      name: "Batch Sim Rev",
    });
    mocks.listAssesseesByBatch.mockResolvedValue([
      { id: "a-1", displayName: "Peserta Satu" },
      { id: "a-2", displayName: "Peserta Dua" },
    ]);
    const copiedAnswer =
      "Penerapan prosedur identifikasi bahaya wajib dijalankan sebelum pekerjaan ruang terbatas dilaksanakan oleh pekerja berizin";
    mocks.listDriveFilesForBatch.mockResolvedValue([
      {
        id: "f-old",
        assesseeId: "a-1",
        docType: "06c",
        fileName: "FR.IA.06C_Lama.docx",
        driveModifiedTime: "2026-11-10T00:00:00Z",
        extractedText: "Jawaban lama yang sama sekali berbeda topik ergonomis kantor",
      },
      {
        id: "f-new",
        assesseeId: "a-1",
        docType: "06c",
        fileName: "FR.IA.06C_Revisi.docx",
        driveModifiedTime: "2026-11-18T00:00:00Z",
        extractedText: copiedAnswer,
      },
      {
        id: "f-p2",
        assesseeId: "a-2",
        docType: "06c",
        fileName: "FR.IA.06C.docx",
        driveModifiedTime: "2026-11-18T00:00:00Z",
        extractedText: copiedAnswer,
      },
    ]);
    mocks.saveSimilarityPairsForBatch.mockResolvedValue(undefined);

    const out = await runWorkerJob({
      id: "job-sim-rev",
      type: "similarity_run",
      userId: "user-1",
      payload: { batchId: "batch-sim", docType: "06c" },
    });

    expect(out.status).toBe("done");
    expect(out.meta).toEqual({ comparedAssessees: 2, flaggedPairs: 1 });
  });

  it("reuses persisted extractedText cache on extract_file without re-downloading from Drive (T5a)", async () => {
    mocks.getDriveFileById.mockResolvedValue({
      id: "db-cached-1",
      driveFileId: "drive-cached-1",
      fileName: "FR.IA.06C.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extractedText: "Teks sudah diekstrak sebelumnya dari database.",
      extractionMethod: "ooxml_docx",
    });

    const res = await runWorkerJob({
      id: "job-extract-cache",
      type: "extract_file",
      userId: "user-1",
      payload: {
        fileId: "db-cached-1",
        driveFileId: "drive-cached-1",
        fileName: "FR.IA.06C.docx",
      },
    });

    expect(res.status).toBe("done");
    expect(res.meta).toMatchObject({ extractionMethod: "ooxml_docx", chars: 46 });
    expect(mocks.updateDriveFileExtraction).not.toHaveBeenCalled();
  });

  it("cleans legacy TUGAS SUANGI display name in-place, never creates fake folder assessees, maps TUGAS DIT WIWI -> Wiwi, and marks encrypted ZIP unextractable (R10)", async () => {
    const batchId = "33333333-3333-4333-8333-333333333333";
    mocks.getBatchById.mockResolvedValue({
      id: batchId,
      lspId: "lsp-1",
      schemeId: "scheme-1",
      name: "Batch R10",
      driveFolderUrl: "https://drive.google.com/drive/folders/rootr10folder",
    });
    mocks.listDriveFilesForBatch.mockResolvedValue([]);

    const existingBefore = [
      { id: "as-suangi", displayName: "TUGAS SUANGI", certificateNameConfirmed: null },
      { id: "as-wiwik", displayName: "WIWIK SRIWAHYUNI BATUBARA", certificateNameConfirmed: null },
      { id: "as-wiwi", displayName: "Wiwi Widiawati, S.K.M", certificateNameConfirmed: null },
    ];
    mocks.listAssesseesByBatch.mockResolvedValue(existingBefore);
    mocks.upsertAssesseesForBatch.mockResolvedValue(existingBefore);
    mocks.upsertDriveFilesForBatch.mockImplementation(async (args: { files: unknown[] }) => args.files.length);
    mocks.pruneOrphanedDuplicateAssessees.mockResolvedValue([]);

    const htmlPage = (entries: Array<{ id: string; title: string; isFolder?: boolean }>) =>
      entries
        .map(
          (e) => `
          <div class="flip-entry" id="entry-${e.id}">
            <a href="${e.isFolder ? `https://drive.google.com/drive/folders/${e.id}` : `https://drive.google.com/file/d/${e.id}/view`}">
              <div class="flip-entry-title">${e.title}</div>
            </a>
          </div>`,
        )
        .join("\n");

    const encryptedZipHeader = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x01, 0x00, 0x08, 0x00, 0x00, 0x00,
    ]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const parsedUrl = new URL(String(input));
      const fid = parsedUrl.searchParams.get("id");
      if (fid === "rootr10folder") {
        return new Response(
          htmlPage([
            { id: "r10-req", title: "Persyaratan Pelatihan AK3 umum BNSP", isFolder: true },
            { id: "r10-dit", title: "Tugas DIT", isFolder: true },
            { id: "enczip12345", title: "EncryptedPack.zip" },
          ]),
          { status: 200 },
        );
      }
      if (fid === "r10-req") {
        return new Response(
          htmlPage([
            { id: "r10-s", title: "18. Suangi", isFolder: true },
            { id: "r10-w1", title: "2. Wiwi Widiawati, S.K.M", isFolder: true },
            { id: "r10-w2", title: "3. Wiwik Sriwahyuni Batubara", isFolder: true },
          ]),
          { status: 200 },
        );
      }
      if (fid === "r10-s") {
        return new Response(htmlPage([{ id: "ktp-suangi", title: "KTP SUANGI.jpg" }]), { status: 200 });
      }
      if (fid === "r10-w1") {
        return new Response(htmlPage([{ id: "ktp-wiwi", title: "KTP wiwi.pdf" }]), { status: 200 });
      }
      if (fid === "r10-w2") {
        return new Response(htmlPage([{ id: "ktp-wiwik", title: "KTP.jpg" }]), { status: 200 });
      }
      if (fid === "r10-dit") {
        return new Response(
          htmlPage([
            { id: "r10-dit-wiwi", title: "TUGAS DIT WIWI", isFolder: true },
            { id: "r10-dit-unknown", title: "Orang Asing Tanpa Persyaratan", isFolder: true },
          ]),
          { status: 200 },
        );
      }
      if (fid === "r10-dit-wiwi") {
        return new Response(htmlPage([{ id: "erp-wiwi", title: "2. Form ERP WIWI.docx" }]), {
          status: 200,
        });
      }
      if (fid === "r10-dit-unknown") {
        return new Response(htmlPage([{ id: "ppt-unknown", title: "Paparan.pptx" }]), {
          status: 200,
        });
      }
      if (fid === "enczip12345") {
        return new Response(encryptedZipHeader, {
          status: 200,
          headers: { "content-type": "application/zip" },
        });
      }
      return new Response("Not Found", { status: 404 });
    });

    const out = await runWorkerJob({
      id: "job-r10-check",
      type: "drive_scan",
      userId: "user-1",
      payload: { batchId },
    });

    expect(out.status).toBe("done");
    // Only Pass 1 authoritative upsert ran; unmatched non-authoritative folder did NOT create a fake assessee
    expect(mocks.upsertAssesseesForBatch).toHaveBeenCalledTimes(1);
    expect(mocks.updateAssesseeDisplayName).toHaveBeenCalledWith({
      userId: "user-1",
      assesseeId: "as-suangi",
      displayName: "Suangi",
    });
    expect(out.meta).toMatchObject({
      renamedAssesseesCount: 1,
      unextractableFiles: 1,
    });
    expect(String(out.meta?.rosterChangeSummary ?? "")).toContain("TUGAS SUANGI → Suangi");
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "batch.roster.reconciled",
        resource: "batches",
        resource_id: batchId,
      }),
      expect.anything(),
    );

    const savedPayload = mocks.upsertDriveFilesForBatch.mock.calls[0]?.[0] as {
      files: Array<{
        fileName: string;
        assesseeId: string | null;
        triageStatus?: string;
        triageReason?: string | null;
      }>;
    };
    const wiwiErp = savedPayload.files.find((f) => f.fileName === "2. Form ERP WIWI.docx");
    const unknownPpt = savedPayload.files.find((f) => f.fileName === "Paparan.pptx");
    const encZip = savedPayload.files.find((f) => f.fileName === "EncryptedPack.zip");

    expect(wiwiErp?.assesseeId).toBe("as-wiwi");
    expect(unknownPpt).toMatchObject({ assesseeId: null, triageStatus: "unmatched" });
    expect(encZip).toMatchObject({ triageStatus: "unextractable" });
    expect(encZip?.triageReason).toContain("terenkripsi");
  });

  it("never auto-activates 06B blanko/encrypted extracted from master MUK archive on drive_scan (R11 Cacat 1)", async () => {
    const batchId = "44444444-4444-4344-8344-444444444444";
    mocks.getBatchById.mockResolvedValue({
      id: batchId,
      lspId: "lsp-1",
      schemeId: "scheme-1",
      name: "Batch MUK Blanko",
      driveFolderUrl: "https://drive.google.com/drive/folders/mukrootfolder",
    });
    mocks.listDriveFilesForBatch.mockResolvedValue([]);
    mocks.listAssesseesByBatch.mockResolvedValue([]);
    mocks.upsertDriveFilesForBatch.mockImplementation(async (args: { files: unknown[] }) => args.files.length);

    const mukZip = new JSZip();
    mukZip.file("FR.MAPA.01.docx", "template mapa 01");
    mukZip.file("FR.VA.docx", "template validasi");
    mukZip.file("FR.AK.01.docx", "template ak01");
    mukZip.file(
      "FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]),
    );
    const mukZipBuffer = await mukZip.generateAsync({ type: "nodebuffer" });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const fid = new URL(String(input)).searchParams.get("id");
      if (fid === "mukrootfolder") {
        return new Response(
          `<div class="flip-entry" id="entry-mukzip99999"><a href="https://drive.google.com/file/d/mukzip99999/view"><div class="flip-entry-title">AK3U MUK.zip</div></a></div>`,
          { status: 200 },
        );
      }
      if (fid === "mukzip99999") {
        return new Response(new Uint8Array(mukZipBuffer), {
          status: 200,
          headers: { "content-type": "application/zip" },
        });
      }
      return new Response("Not Found", { status: 404 });
    });

    const res = await runWorkerJob({
      id: "job-muk-scan",
      type: "drive_scan",
      userId: "user-1",
      payload: { batchId },
    });

    expect(res.status).toBe("done");
    expect(mocks.setBatchActiveMasterKey).not.toHaveBeenCalled();

    const savedPayload = mocks.upsertDriveFilesForBatch.mock.calls[0]?.[0] as {
      files: Array<{ docType: string; triageStatus?: string; triageReason?: string | null }>;
    };
    const extracted06b = savedPayload.files.find((f) => f.docType === "06b");
    expect(extracted06b).toMatchObject({
      docType: "06b",
      triageStatus: "not_needed",
    });
    expect(extracted06b?.triageReason).toContain("tidak diaktifkan otomatis sebagai kunci master");
  });

  it("blocks written_grading when activeMasterKeyFileId is null or key text is a blanko (R11 Cacat 1)", async () => {
    mocks.getAssesseeById.mockResolvedValue({
      id: "as-1",
      lspId: "lsp-1",
      batchId: "b-1",
      displayName: "Budi Santoso",
      pseudonym: "ASESI-001",
    });
    mocks.getBatchById.mockResolvedValue({
      id: "b-1",
      lspId: "lsp-1",
      schemeId: "scheme-1",
      name: "Demo Audit R4",
      activeMasterKeyFileId: null,
      activeMasterKeyValidationStatus: null,
    });
    mocks.listDriveFilesForBatch.mockResolvedValue([
      {
        id: "blanko-06b-id",
        assesseeId: null,
        docType: "06b",
        fileName: "FR.IA.06B. LEMBAR KUNCI.docx",
        extractedText: null,
      },
      {
        id: "student-06c-id",
        assesseeId: "as-1",
        docType: "06c",
        fileName: "FR.IA.06C_Budi.docx",
        extractedText: "1. Bahaya adalah sumber potensi bahaya kerja di lapangan.",
      },
    ]);

    await expect(
      runWorkerJob({
        id: "job-wg-blocked-no-active",
        type: "written_grading",
        userId: "user-1",
        payload: { batchId: "b-1", assesseeId: "as-1" },
      }),
    ).rejects.toThrow("INVALID_MASTER_KEY_06B");

    await expect(
      runWorkerJob({
        id: "job-wg-blocked-blanko-text",
        type: "written_grading",
        userId: "user-1",
        payload: {
          batchId: "b-1",
          assesseeId: "as-1",
          masterKeyText:
            "FR.IA.06B.\nLEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI\nSkema Sertifikasi\nJawaban:\n1.\n2.\nUmpan balik untuk Asesi :",
        },
      }),
    ).rejects.toThrow("INVALID_MASTER_KEY_06B");
  });

  it("prevents duplicate job.drive_scan.failed audit events when executeJob is invoked again on a terminal failed job (R13 Cacat 2)", async () => {
    const batchId = "a3b77bbe-7543-48b7-99e1-25e286689999";
    const jobId = "82988849-c68b-4447-9f8b-07ec816784be";
    const lspId = "b03afb00-9266-467d-823e-44a7830a4077";

    const pendingJob = {
      id: jobId,
      createdBy: "user-1",
      type: "drive_scan",
      status: "pending" as const,
      payload: { batchId, driveFolderUrl: "https://drive.google.com/drive/folders/invalid" },
      progress: 0,
      error: null,
      attempts: 0,
      createdAt: "2026-11-18T06:16:26Z",
      updatedAt: "2026-11-18T06:16:26Z",
    };
    const failedJob = {
      ...pendingJob,
      status: "failed" as const,
      error: "DRIVE_API_KEY_MISSING",
      attempts: 1,
    };

    mocks.getBatchById.mockResolvedValue({
      id: batchId,
      lspId,
      schemeId: "scheme-1",
      name: "Demo Audit R3",
    });
    mocks.getJobRecordById
      .mockResolvedValueOnce(pendingJob)
      .mockResolvedValueOnce(failedJob)
      .mockResolvedValueOnce(failedJob);
    mocks.updateJobStatusRecord.mockResolvedValue(undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Not Found", { status: 404 }));

    await executeJob("user-1", jobId, { lspId });
    const firstFailedCalls = mocks.writeAuditLog.mock.calls.filter(
      (c) => c[0]?.action === "job.drive_scan.failed",
    );
    expect(firstFailedCalls).toHaveLength(1);

    // Second invocation without triggerAction="retry" must be a complete no-op
    const secondResult = await executeJob("user-1", jobId, { lspId });
    expect(secondResult).toEqual(failedJob);

    const totalFailedCalls = mocks.writeAuditLog.mock.calls.filter(
      (c) => c[0]?.action === "job.drive_scan.failed",
    );
    expect(totalFailedCalls).toHaveLength(1);
  });

  it("extracts high-confidence Drive surat_tugas files and auto-fills empty batch assessmentDate & tukName", async () => {
    const batchId = "66666666-6666-4666-8666-666666666666";
    const lspId = "lsp-1";
    mocks.getBatchById.mockResolvedValue({
      id: batchId,
      lspId,
      schemeId: "scheme-1",
      name: "Batch ST Auto",
      tukName: null,
      assessmentDate: null,
      driveFolderUrl: "https://drive.google.com/drive/folders/stautofolder1",
    });
    mocks.listDriveFilesForBatch.mockResolvedValue([]);
    mocks.listAssesseesByBatch.mockResolvedValue([]);
    mocks.upsertAssesseesForBatch.mockImplementation(async (args: { names: string[] }) =>
      args.names.map((n, i) => ({ id: `as-${i}`, displayName: n })),
    );
    mocks.upsertDriveFilesForBatch.mockImplementation(async (args: { files: unknown[] }) => args.files.length);
    mocks.pruneOrphanedDuplicateAssessees.mockResolvedValue([]);
    mocks.updateBatchMetadata.mockResolvedValue({ id: batchId });

    const stText = [
      "SURAT TUGAS",
      "Nomor Surat: ST - 210 / 20 26",
      "Tempat Uji Kompetensi (TUK): TUK Sewaktu K3 Prima (Ruang Serbaguna)",
      "Tanggal Pelaksanaan: 22 November 2026",
      "Asesor Kompetensi: Budi Santoso, S.T.",
      "DAFTAR PESERTA",
      "1. Peserta Satu",
      "2. Peserta Dua",
    ].join("\n");

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "drive.google.com" && url.pathname.includes("embeddedfolderview")) {
        return new Response(
          `<div class="flip-entry" id="entry-stfile123456789"><a href="https://drive.google.com/file/d/stfile123456789/view"><div class="flip-entry-title">Surat_Tugas_Batch.txt</div></a></div>`,
          { status: 200 },
        );
      }
      if (url.searchParams.get("id") === "stfile123456789") {
        return new Response(stText, {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      return new Response("Not Found", { status: 404 });
    });

    const res = await runWorkerJob({
      id: "job-st-autofill",
      type: "drive_scan",
      userId: "user-1",
      payload: { batchId },
    });

    expect(res.status).toBe("done");
    expect(mocks.updateBatchMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId,
        assessmentDate: "2026-11-22",
        tukName: "TUK Sewaktu K3 Prima",
      }),
    );
  });

  it("surfaces extraction error details on dit_analysis when Drive file extraction fails or PDF is scan-only", async () => {
    mocks.getAssesseeById.mockResolvedValue({
      id: "as-scan",
      lspId: "lsp-1",
      batchId: "b-scan",
      displayName: "Asesi Uji",
      pseudonym: "ASESI-001",
    });
    mocks.getBatchById.mockResolvedValue({
      id: "b-scan",
      lspId: "lsp-1",
      schemeId: "scheme-1",
      name: "Simulasi DIT",
    });
    mocks.listDriveFilesForBatch.mockResolvedValue([
      {
        id: "f-04a",
        assesseeId: "as-scan",
        docType: "04a",
        fileName: "FR.IA.04A.docx",
        driveFileId: "drive04a12345",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extractedText: "Daftar Instruksi Terstruktur lengkap proyek K3.",
        driveModifiedTime: null,
      },
      {
        id: "f-04b",
        assesseeId: "as-scan",
        docType: "04b",
        fileName: "Presentasi.pptx",
        driveFileId: "drive04b12345",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        extractedText: "Slide presentasi pengendalian risiko bahaya ruang terbatas.",
        driveModifiedTime: null,
      },
      {
        id: "f-cv",
        assesseeId: "as-scan",
        docType: "cv",
        fileName: "CV_Scan.pdf",
        driveFileId: "drivecvscan123",
        mimeType: "application/pdf",
        extractedText: null,
        driveModifiedTime: null,
      },
    ]);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(Buffer.from("%PDF-1.4\n%%EOF", "latin1"), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );

    await expect(
      runWorkerJob({
        id: "job-dit-scan-fail",
        type: "dit_analysis",
        userId: "user-1",
        payload: { assesseeId: "as-scan" },
      }),
    ).rejects.toThrow(/Bahan DIT belum lengkap setelah ekstraksi.*CV_Scan\.pdf.*lapisan teks/);
  });

  it("marks running jobs stale right after the 300s Vercel limit (STALE_RUNNING_MS = 305s)", () => {
    const baseTime = Date.parse("2026-11-24T06:02:45.000Z");
    expect(STALE_RUNNING_MS).toBe(305_000);
    expect(
      isStaleRunningJob(
        { status: "running", updatedAt: "2026-11-24T06:02:45.000Z" },
        baseTime + 300_000,
      ),
    ).toBe(false);
    expect(
      isStaleRunningJob(
        { status: "running", updatedAt: "2026-11-24T06:02:45.000Z" },
        baseTime + 306_000,
      ),
    ).toBe(true);
  });

  it("preserves existing saved official06c and confirmedBy/confirmedAt when written_grading re-runs", async () => {
    const savedOfficial06c = {
      items: [{ questionNo: 1, answerText: "Jawaban resmi", achieved: true }],
      overallAchieved: true,
      feedbackDetail: "Ditetapkan oleh asesor.",
      assessedBy: "user-1",
      assessedAt: "2026-11-25T08:00:00.000Z",
    };

    mocks.getAssesseeById.mockResolvedValue({
      id: "as-wg-retain",
      lspId: "lsp-1",
      batchId: "b-wg-retain",
      displayName: "Budi Santoso",
      pseudonym: "ASESI-001",
    });
    mocks.getBatchById.mockResolvedValue({
      id: "b-wg-retain",
      lspId: "lsp-1",
      schemeId: "scheme-1",
      name: "Batch Written Retain",
      activeMasterKeyFileId: "key-1",
      activeMasterKeyValidationStatus: "valid",
    });
    mocks.listDriveFilesForBatch.mockResolvedValue([
      {
        id: "key-1",
        assesseeId: null,
        docType: "06b",
        fileName: "FR.IA.06B_Kunci.docx",
        extractedText: "1. Kunci jawaban nomor 1 lengkap.\n2. Kunci jawaban nomor 2 lengkap.",
      },
      {
        id: "ans-1",
        assesseeId: "as-wg-retain",
        docType: "06c",
        fileName: "FR.IA.06C_Budi.docx",
        extractedText: "1. Jawaban kandidat 1.\n2. Jawaban kandidat 2.",
      },
    ]);
    mocks.getLatestProviderConfigForAssessor.mockResolvedValue({
      provider: "openai",
      encryptedApiKey: "iv:tag:cipher",
      baseUrl: null,
      encryptedGatewayToken: null,
      model: "gpt-4o-mini",
      temperature: 0,
      maxTokens: 4096,
    });
    vi.spyOn(encryption, "decryptSecret").mockReturnValue("sk-test-fake");
    vi.mocked(assessmentRepo.getLatestWrittenGrading).mockResolvedValueOnce({
      id: "wg-prev",
      lspId: "lsp-1",
      batchId: "b-wg-retain",
      assesseeId: "as-wg-retain",
      formMapping: {
        soal: "06A",
        kunci: "06B",
        jawaban: "06C",
        official06c: savedOfficial06c,
      },
      confirmedBy: "user-1",
      confirmedAt: "2026-11-25T08:00:00.000Z",
    } as never);
    vi.spyOn(gradingService, "runWrittenGradingPipeline").mockResolvedValueOnce({
      ok: true,
      promptVersion: "v1.0.0",
      output: {
        pseudonym: "ASESI-001",
        itemVerdicts: [
          {
            questionNo: 1,
            verdict: "Salah",
            masterSpan: "Kunci 1",
            studentSpan: "Jawaban 1",
            explanation: "AI baru menganggap salah.",
          },
        ],
        ringkasanKesalahan: [1],
        vatmUnitRecommendations: [],
        plagiarismReport: { status: "Bersih", reasoning: "Unik", flaggedQuestions: [] },
      },
    });

    const res = await runWorkerJob({
      id: "job-wg-retain",
      type: "written_grading",
      userId: "user-1",
      payload: { batchId: "b-wg-retain", assesseeId: "as-wg-retain" },
    });

    expect(res.status).toBe("done");
    expect(assessmentRepo.saveWrittenGrading).toHaveBeenCalledWith(
      expect.objectContaining({
        formMapping: expect.objectContaining({
          soal: "06A",
          kunci: "06B",
          jawaban: "06C",
          official06c: savedOfficial06c,
        }),
        confirmedBy: "user-1",
        confirmedAt: "2026-11-25T08:00:00.000Z",
      }),
    );
  });
});
