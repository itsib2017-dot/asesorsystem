import { describe, expect, it, vi } from "vitest";
import type { BatchSummary, DriveFileRecord } from "@/repositories/batches.repository";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import {
  resolveBatchActiveMasterKey,
  validateMasterKey06bContent,
} from "../master-key";

const REAL_BNSP_BLANKO_06B = `FR.IA.06B.

LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI

Skema Sertifikasi
(KKNI/Okupasi/Klaster)
Judul
:
AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM
Nomor
:
SKM/2037/00013/2/2021/1
TUK
:
Sewaktu/Tempat Kerja/Mandiri*
Nama Asesor
:
Nama Asesi
:
Tanggal
:
Waktu
:
*Coret yang tidak perlu

Jawaban:
Pencapaian
Ya
Tidak

1.
2.
3.

Umpan balik untuk Asesi
:
Aspek pengetahuan seluruh unit pada kelompok pekerjaan yang diujikan (tercapai/belum tercapai)*
Tuliskan unit/elemen/KUK jika belum tercapai: ..........
*Coret yang tidak perlu

Asesi :
Nama
:
Tanda tangan & tanggal
:
Asesor :
Nama
:
No. Reg
:
Tanda tangan & tanggal
:`;

const REAL_BNSP_06A_QUESTIONS = `FR.IA.06A.

DPT – DAFTAR PERTANYAAN TERTULIS ESAI

Skema Sertifikasi
(KKNI/Okupasi/Klaster)
Judul
:
AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM
Nomor
:
SKM/2037/00013/2/2021/1

JAWABLAH SEMUA PERTANYAAN DI BAWAH INI:
Apa perbedaan antara Bahaya (Hazard) dan Risiko (Risk)?
Apa saja yang perlu dipertimbangkan dalam menentukan lokasi titik kumpul?
Jelaskan arti rambu-rambu K3 tersebut!`;

const VALID_WORKING_06B = `FR.IA.06B.
LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI
Skema Sertifikasi : AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM
Nomor : SKM/2037/00013/2/2021/1
TUK : Sewaktu

Kunci Jawaban:
1. Bahaya (Hazard) adalah sumber, situasi, atau tindakan yang berpotensi menimbulkan cedera atau gangguan kesehatan manusia, sedangkan Risiko (Risk) adalah kombinasi antara kemungkinan terjadinya kejadian berbahaya dengan tingkat keparahan cedera atau kerusakan yang ditimbulkan.
2. Pertimbangan lokasi titik kumpul: area terbuka aman dari runtuhan gedung, berjarak aman dari sumber bahaya listrik dan bahan mudah terbakar, memiliki jalur evakuasi bebas hambatan, serta dilengkapi rambu yang terlihat jelas.
3. Rambu warna merah menunjukkan larangan atau peralatan pemadam kebakaran, warna kuning berarti peringatan bahaya, warna biru menandakan kewajiban APD, dan warna hijau menunjukkan jalur evakuasi serta P3K.

Umpan balik untuk Asesi :`;

function makeBatch(overrides: Partial<BatchSummary> = {}): BatchSummary {
  return {
    id: "f98e5671-fbcb-42cb-a724-9f69d24f780b",
    lspId: "b03afb00-9266-467d-823e-44a7830a4077",
    schemeId: "cb75c1cc-8019-42fb-bc33-e675516ec4ad",
    name: "Demo Audit R4",
    status: "draft",
    tukName: "TUK Sewaktu",
    tukType: "sewaktu",
    assessmentDate: null,
    driveFolderUrl: null,
    kelompokSheetUrl: null,
    activeMasterKeyFileId: null,
    activeMasterKeySource: null,
    activeMasterKeyValidationStatus: null,
    activeMasterKeyValidationSummary: null,
    activeMasterKeyActivatedAt: null,
    activeMasterKeyActivatedBy: null,
    createdBy: "user-1",
    createdAt: "2026-11-18T00:00:00Z",
    ...overrides,
  };
}

function makeDriveFile(overrides: Partial<DriveFileRecord>): DriveFileRecord {
  return {
    id: "file-1",
    lspId: "b03afb00-9266-467d-823e-44a7830a4077",
    batchId: "f98e5671-fbcb-42cb-a724-9f69d24f780b",
    assesseeId: null,
    driveFileId: "drive-1",
    fileName: "FR.IA.06B.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    drivePath: "FR.IA.06B.docx",
    docType: "06b",
    classificationConfidence: 1,
    triageStatus: "not_needed",
    triageReason: null,
    extractedText: null,
    extractionMethod: null,
    ocrConfidence: null,
    driveModifiedTime: null,
    archiveParentId: null,
    archiveEntryPath: null,
    ...overrides,
  };
}

describe("FR.IA.06B master key content validator & resolver (Round 11 Cacat 1)", () => {
  it("rejects empty strings, embedded-image placeholders, BNSP blanko skeletons, and FR.IA.06A question sheets", () => {
    expect(validateMasterKey06bContent("")).toMatchObject({
      valid: false,
      status: "empty_or_blanko",
    });

    expect(
      validateMasterKey06bContent("[Dokumen berisi 3 gambar tersemat — perlu tinjauan manual]"),
    ).toMatchObject({
      valid: false,
      status: "empty_or_blanko",
      detectedBlanko: true,
    });

    const blankoResult = validateMasterKey06bContent(REAL_BNSP_BLANKO_06B);
    expect(blankoResult).toMatchObject({
      valid: false,
      status: "empty_or_blanko",
      detectedBlanko: true,
    });

    const headerOnlyNoMarker = `FR.IA.06B.
LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI
Skema Sertifikasi
Judul : AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM
Nomor : SKM/2037/00013/2/2021/1
1.
2. [Isi jawaban di sini]
Penyusun dan Validator`;
    expect(validateMasterKey06bContent(headerOnlyNoMarker)).toMatchObject({
      valid: false,
      status: "empty_or_blanko",
      detectedBlanko: true,
    });

    expect(validateMasterKey06bContent(REAL_BNSP_06A_QUESTIONS)).toMatchObject({
      valid: false,
      status: "empty_or_blanko",
      detectedQuestionSheet06a: true,
    });
  });

  it("accepts valid working FR.IA.06B documents and plain text answer keys", () => {
    const validBnsp = validateMasterKey06bContent(VALID_WORKING_06B);
    expect(validBnsp.valid).toBe(true);
    expect(validBnsp.status).toBe("valid");
    expect(validBnsp.substantiveWords).toBeGreaterThanOrEqual(40);

    const validTxt = validateMasterKey06bContent(
      "Kunci Jawaban FR.IA.06B: 1. Bahaya adalah potensi cedera dan risiko adalah peluang keparahan.",
    );
    expect(validTxt.valid).toBe(true);
    expect(validTxt.status).toBe("valid");
  });

  it("never treats unactivated MUK blanko or Drive candidates as active in resolveBatchActiveMasterKey", () => {
    const zipBlanko = makeDriveFile({
      id: "blanko-zip-uuid",
      driveFileId: "1Jl1TfI9IC::FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
      fileName: "FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
      archiveEntryPath: "FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx",
      extractedText: null,
      driveModifiedTime: "2026-11-19T10:00:00Z",
    });

    const batchNoKey = makeBatch({ activeMasterKeyFileId: null });
    const unresolved = resolveBatchActiveMasterKey(batchNoKey, [zipBlanko]);
    expect(unresolved.activeFile).toBeNull();
    expect(unresolved.isReadyForGrading).toBe(false);
    expect(unresolved.blockingWarning).toContain("arsip MUK");
    expect(unresolved.candidates).toHaveLength(1);
    expect(unresolved.candidates[0]).toMatchObject({
      id: "blanko-zip-uuid",
      isActive: false,
      canActivate: false,
      origin: "archive_extract",
      originLabel: "Ekstrak Arsip MUK",
    });

    const unactivatedDriveValid = makeDriveFile({
      id: "drive-valid-uuid",
      driveFileId: "drive-working-06b",
      fileName: "Kunci_06B_Kerja.docx",
      extractedText: VALID_WORKING_06B,
    });
    const needsExplicitPick = resolveBatchActiveMasterKey(batchNoKey, [
      zipBlanko,
      unactivatedDriveValid,
    ]);
    expect(needsExplicitPick.activeFile).toBeNull();
    expect(needsExplicitPick.isReadyForGrading).toBe(false);
    expect(
      needsExplicitPick.candidates.find((c) => c.id === "drive-valid-uuid")?.canActivate,
    ).toBe(true);

    const assessorUpload = makeDriveFile({
      id: "upload-valid-uuid",
      driveFileId: `manual-06b-${batchNoKey.id}`,
      fileName: "FR.IA.06B_Kunci_Kerja.docx",
      drivePath: "Manual Upload/FR.IA.06B_Kunci_Kerja.docx",
      extractedText: VALID_WORKING_06B,
      driveModifiedTime: "2026-11-19T08:00:00Z",
    });
    const batchActive = makeBatch({
      activeMasterKeyFileId: "upload-valid-uuid",
      activeMasterKeySource: "assessor_upload",
      activeMasterKeyValidationStatus: "valid",
      activeMasterKeyActivatedAt: "2026-11-19T14:40:00Z",
    });
    const resolved = resolveBatchActiveMasterKey(batchActive, [zipBlanko, assessorUpload]);
    expect(resolved.isReadyForGrading).toBe(true);
    expect(resolved.activeFile?.id).toBe("upload-valid-uuid");
    expect(resolved.activeOriginLabel).toBe("Unggahan Asesor");
    expect(resolved.blockingWarning).toBeNull();
  });
});
