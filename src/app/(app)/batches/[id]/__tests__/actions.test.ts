import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getUser: vi.fn(),
  requireLspRole: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  writeAuditLog: vi.fn(),
  getBatchById: vi.fn(),
  getDriveFileById: vi.fn(),
  setBatchActiveMasterKey: vi.fn(),
  clearBatchActiveMasterKey: vi.fn(),
  updateDriveFileExtraction: vi.fn(),
  updateDriveFileTriage: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/auth/get-session", () => ({
  getUser: mocks.getUser,
}));

vi.mock("@/lib/auth/get-role", () => ({
  requireLspRole: mocks.requireLspRole,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/repositories/batches.repository", () => ({
  clearBatchActiveMasterKey: mocks.clearBatchActiveMasterKey,
  getBatchById: mocks.getBatchById,
  getDriveFileById: mocks.getDriveFileById,
  setBatchActiveMasterKey: mocks.setBatchActiveMasterKey,
  updateDriveFileExtraction: mocks.updateDriveFileExtraction,
  updateDriveFileTriage: mocks.updateDriveFileTriage,
}));

vi.mock("@/services/drive-extract", () => ({
  downloadPublicDriveFileBuffer: vi.fn(),
}));

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clearRateLimitBucketsForTest } from "@/lib/security/rate-limit";
import { BatchKeyUploadPanel } from "@/components/batch/batch-key-upload-panel";
import { activateBatchMasterKey06bAction } from "../actions";

const USER_ID = "e27f3fa3-d2d2-494f-b05c-c97f18446e9f";
const LSP_ID = "b03afb00-9266-467d-823e-44a7830a4077";
const BATCH_ID = "f98e5671-fbcb-42cb-a724-9f69d24f780b";
const FILE_ID = "2179b19b-1c9e-4ad6-a2f6-d7816ec9f7ab";

function makeFormData(batchId = BATCH_ID, fileId = FILE_ID): FormData {
  const fd = new FormData();
  fd.set("batchId", batchId);
  fd.set("fileId", fileId);
  return fd;
}

describe("activateBatchMasterKey06bAction (Round 13 Cacat 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitBucketsForTest();
    mocks.getUser.mockResolvedValue({ id: USER_ID });
    mocks.requireLspRole.mockResolvedValue({ allowed: true, role: "lsp_admin" });
    mocks.getSupabaseServerClient.mockResolvedValue({});
    mocks.writeAuditLog.mockResolvedValue("corr-06b-1");
    mocks.getBatchById.mockResolvedValue({
      id: BATCH_ID,
      lspId: LSP_ID,
      name: "Demo Audit R4",
    });
  });

  it("rejects encrypted/unextracted MUK archive blanko 06B and writes batch.key_06b.activate.rejected", async () => {
    mocks.getDriveFileById.mockResolvedValue({
      id: FILE_ID,
      lspId: LSP_ID,
      batchId: BATCH_ID,
      assesseeId: null,
      driveFileId: "1Jl1TfI9IC::FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
      fileName: "FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      drivePath: "FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
      docType: "06b",
      classificationConfidence: 1,
      triageStatus: "not_needed",
      triageReason: null,
      extractedText: null,
      extractionMethod: null,
      ocrConfidence: null,
      driveModifiedTime: null,
      archiveParentId: null,
      archiveEntryPath: "FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
    });

    const res = await activateBatchMasterKey06bAction(makeFormData());

    expect(res.ok).toBe(false);
    expect(res.error).toContain("ditolak");
    expect(res.error).toContain("encrypted_unreadable");
    expect(res.validationSummary).toContain("encrypted_unreadable");
    expect(mocks.setBatchActiveMasterKey).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(1);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        lsp_id: LSP_ID,
        actor_id: USER_ID,
        action: "batch.key_06b.activate.rejected",
        resource: "batches",
        resource_id: BATCH_ID,
        after_summary: expect.objectContaining({
          fileId: FILE_ID,
          fileName: "FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
          source: "archive_extract",
          validationStatus: "encrypted_unreadable",
          substantiveWords: 0,
          rejectionReason: expect.stringContaining("blanko kosong atau terenkripsi"),
        }),
      }),
      expect.anything(),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/audit");
  });

  it("rejects extracted blanko skeleton 06B and writes batch.key_06b.activate.rejected", async () => {
    mocks.getDriveFileById.mockResolvedValue({
      id: FILE_ID,
      lspId: LSP_ID,
      batchId: BATCH_ID,
      assesseeId: null,
      driveFileId: "drive-blanko-06b",
      fileName: "FR.IA.06B_Blanko.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      drivePath: "FR.IA.06B_Blanko.docx",
      docType: "06b",
      classificationConfidence: 1,
      triageStatus: "not_needed",
      triageReason: null,
      extractedText:
        "FR.IA.06B.\nLEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI\nSkema Sertifikasi\nJawaban:\n1.\n2.\nUmpan balik untuk Asesi :",
      extractionMethod: "ooxml_docx",
      ocrConfidence: null,
      driveModifiedTime: null,
      archiveParentId: null,
      archiveEntryPath: null,
    });

    const res = await activateBatchMasterKey06bAction(makeFormData());

    expect(res.ok).toBe(false);
    expect(res.error).toContain("empty_or_blanko");
    expect(mocks.setBatchActiveMasterKey).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "batch.key_06b.activate.rejected",
        after_summary: expect.objectContaining({
          fileId: FILE_ID,
          source: "drive_file",
          validationStatus: "empty_or_blanko",
          substantiveWords: 0,
        }),
      }),
      expect.anything(),
    );
  });

  it("denies unauthorized role and cross-batch IDOR fileId without leaking or logging activation", async () => {
    mocks.requireLspRole.mockResolvedValueOnce({ allowed: false, role: "tuk_admin" });
    const denied = await activateBatchMasterKey06bAction(makeFormData());
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain("Akses ditolak");
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();

    mocks.getDriveFileById.mockResolvedValueOnce({
      id: FILE_ID,
      batchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      docType: "06b",
    });
    const idor = await activateBatchMasterKey06bAction(makeFormData());
    expect(idor.ok).toBe(false);
    expect(idor.error).toBe("Berkas kandidat kunci 06B tidak ditemukan pada batch ini.");
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("activates valid working 06B key and writes batch.key_06b.activate", async () => {
    mocks.getDriveFileById.mockResolvedValue({
      id: FILE_ID,
      lspId: LSP_ID,
      batchId: BATCH_ID,
      assesseeId: null,
      driveFileId: "drive-valid-06b",
      fileName: "FR.IA.06B_Kerja.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      drivePath: "FR.IA.06B_Kerja.docx",
      docType: "06b",
      classificationConfidence: 1,
      triageStatus: "not_needed",
      triageReason: null,
      extractedText:
        "Kunci Jawaban FR.IA.06B: 1. Bahaya (Hazard) adalah sumber atau situasi yang berpotensi menimbulkan cedera, sedangkan Risiko (Risk) adalah kombinasi peluang dan tingkat keparahan.",
      extractionMethod: "ooxml_docx",
      ocrConfidence: null,
      driveModifiedTime: null,
      archiveParentId: null,
      archiveEntryPath: null,
    });
    mocks.setBatchActiveMasterKey.mockResolvedValue({ ok: true });
    mocks.updateDriveFileTriage.mockResolvedValue(undefined);

    const res = await activateBatchMasterKey06bAction(makeFormData());

    expect(res.ok).toBe(true);
    expect(mocks.setBatchActiveMasterKey).toHaveBeenCalledTimes(1);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "batch.key_06b.activate",
        after_summary: expect.objectContaining({
          fileId: FILE_ID,
          validationStatus: "valid",
        }),
      }),
      expect.anything(),
    );
  });

  it("renders per-file 'Coba Aktifkan / Uji Validasi' control on blanko/unreadable 06B candidate card (Round 13 Cacat 1 UI)", () => {
    const html = renderToStaticMarkup(
      React.createElement(BatchKeyUploadPanel, {
        batchId: BATCH_ID,
        activeKeyFileName: null,
        activeKeySourceLabel: null,
        activeKeyDrivePath: null,
        activeKeyValidationSummary: null,
        activeKeyActivatedAt: null,
        isReadyForGrading: false,
        blockingWarning: "Belum ada kunci jawaban 06B kerja yang aktif.",
        candidates: [
          {
            id: FILE_ID,
            fileName: "FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
            drivePath: "FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
            originLabel: "Ekstrak Arsip MUK",
            isActive: false,
            isEncryptedOrUnextracted: true,
            canActivate: false,
            statusLabel: "Tidak Aktif (Blanko / Terenkripsi)",
            reasonSummary: "Blanko/template 06B terenkripsi dari arsip MUK",
          },
        ],
      }),
    );

    expect(html).toContain(`data-testid="try-activate-06b-${FILE_ID}"`);
    expect(html).toContain("Coba Aktifkan / Uji Validasi");
    expect(html).toContain("Tidak dapat diaktifkan (blanko / tidak terbaca)");
  });
});
