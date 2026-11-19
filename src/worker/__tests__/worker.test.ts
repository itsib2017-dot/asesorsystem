import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueJobRecord: vi.fn(),
  getJobRecordById: vi.fn(),
  updateJobStatusRecord: vi.fn(),
  updateDriveFileExtraction: vi.fn(),
  updateDriveFileClassification: vi.fn(),
  upsertDriveFilesForBatch: vi.fn(),
  getBatchById: vi.fn(),
  getDriveFileById: vi.fn(),
  listDriveFilesForBatch: vi.fn(),
  listAssesseesByBatch: vi.fn(),
  upsertAssesseesForBatch: vi.fn(),
  pruneOrphanedDuplicateAssessees: vi.fn(),
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
  getDriveFileById: mocks.getDriveFileById,
  listDriveFilesForBatch: mocks.listDriveFilesForBatch,
  updateDriveFileExtraction: mocks.updateDriveFileExtraction,
  updateDriveFileClassification: mocks.updateDriveFileClassification,
  upsertDriveFilesForBatch: mocks.upsertDriveFilesForBatch,
}));

vi.mock("@/repositories/assessees.repository", () => ({
  getAssesseeById: mocks.getAssesseeById,
  listAssesseesByBatch: mocks.listAssesseesByBatch,
  saveNameJuryVerdictAndOcr: mocks.saveNameJuryVerdictAndOcr,
  upsertAssesseesForBatch: mocks.upsertAssesseesForBatch,
  pruneOrphanedDuplicateAssessees: mocks.pruneOrphanedDuplicateAssessees,
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

import JSZip from "jszip";
import { runWorkerJob } from "../index";
import { enqueueJob, executeJob } from "../queue";

describe("Worker dispatcher and queue runner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.getLatestProviderConfigForAssessor.mockResolvedValue(null);
    mocks.getConfig.mockResolvedValue(null);
    mocks.getSupabaseServerClient.mockResolvedValue({});
    mocks.writeAuditLog.mockResolvedValue("corr-1");
    mocks.listUserMemberships.mockResolvedValue([]);
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
    mocks.pruneOrphanedDuplicateAssessees.mockResolvedValue(["as-dup-bagas", "as-dup-suangi"]);

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
});
