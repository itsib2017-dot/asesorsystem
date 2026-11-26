import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockCheckRateLimit,
  mockGetBatchById,
  mockGetActiveSignature,
  mockListAssesseesByBatch,
  mockGetAssessorProfile,
  mockListSchemes,
  mockGetAk05ReportForBatch,
  mockListDriveFilesForBatch,
  mockListDecisionsForAssessee,
  mockGetAssesseeDecisionOverride,
  mockGetLatestDitAnalysis,
  mockGetLatestWrittenGrading,
  mockGetLatestInterviewAssessment,
  mockResolveAk05BatchRows,
  mockWriteAuditLog,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockGetBatchById: vi.fn(),
  mockGetActiveSignature: vi.fn(),
  mockListAssesseesByBatch: vi.fn(),
  mockGetAssessorProfile: vi.fn(),
  mockListSchemes: vi.fn(),
  mockGetAk05ReportForBatch: vi.fn(),
  mockListDriveFilesForBatch: vi.fn(),
  mockListDecisionsForAssessee: vi.fn(),
  mockGetAssesseeDecisionOverride: vi.fn(),
  mockGetLatestDitAnalysis: vi.fn(),
  mockGetLatestWrittenGrading: vi.fn(),
  mockGetLatestInterviewAssessment: vi.fn(),
  mockResolveAk05BatchRows: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth/get-session", () => ({ getUser: mockGetUser }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }));
vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mockGetBatchById,
  listDriveFilesForBatch: mockListDriveFilesForBatch,
}));
vi.mock("@/repositories/signatures.repository", () => ({
  getActiveSignature: mockGetActiveSignature,
}));
vi.mock("@/repositories/assessees.repository", () => ({
  listAssesseesByBatch: mockListAssesseesByBatch,
}));
vi.mock("@/repositories/auth.repository", () => ({
  getAssessorProfile: mockGetAssessorProfile,
}));
vi.mock("@/repositories/schemes.repository", () => ({
  listSchemes: mockListSchemes,
}));
vi.mock("@/repositories/assessment.repository", () => ({
  getAk05ReportForBatch: mockGetAk05ReportForBatch,
  listDecisionsForAssessee: mockListDecisionsForAssessee,
  getAssesseeDecisionOverride: mockGetAssesseeDecisionOverride,
  getLatestDitAnalysis: mockGetLatestDitAnalysis,
  getLatestWrittenGrading: mockGetLatestWrittenGrading,
  getLatestInterviewAssessment: mockGetLatestInterviewAssessment,
}));
vi.mock("@/lib/ak05/rollup", () => ({
  resolveAk05BatchRows: mockResolveAk05BatchRows,
}));
vi.mock("@/services/export", () => ({
  resolveSchemeTemplateBuffer: vi.fn(async () => Buffer.from("tpl")),
  generateAk05Pdf: vi.fn(async () => Buffer.from("%PDF-1.4\n")),
  generateAk05Docx: vi.fn(async () => Buffer.from("PK-AK05")),
  generateAk02Docx: vi.fn(async () => Buffer.from("PK-AK02")),
  generateIa04aDocx: vi.fn(async () => Buffer.from("PK-04A")),
  generateIa04bDocx: vi.fn(async () => Buffer.from("PK-04B")),
  generateIa06cDocx: vi.fn(async () => Buffer.from("PK-06C")),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    storage: {
      from: () => ({
        download: async () => ({
          data: new Blob([Uint8Array.from([137, 80, 78, 71])]),
        }),
      }),
    },
  })),
}));
vi.mock("@/lib/audit/write-audit-log", () => ({ writeAuditLog: mockWriteAuditLog }));

import { GET } from "../route";

const USER_ID = "00000000-0000-4000-8000-000000000010";
const BATCH_ID = "00000000-0000-4000-8000-000000000020";

describe("GET /api/v1/batches/[id]/export-pack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: USER_ID, email: "asesor@lsp.test" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    mockGetBatchById.mockResolvedValue({
      id: BATCH_ID,
      lspId: "00000000-0000-4000-8000-000000000001",
      schemeId: "00000000-0000-4000-8000-000000000002",
      name: "Batch K3 Uji",
      tukName: "TUK Sewaktu Jakarta",
      tukType: "sewaktu",
      assessmentDate: "2026-11-26",
    });
    mockGetActiveSignature.mockResolvedValue({
      storagePath: "sig.png",
      mimeType: "image/png",
      signedUrl: null,
    });
    mockGetAssessorProfile.mockResolvedValue({
      fullName: "Daniel Stefanus",
      regNoMet: "MET.000.003610",
    });
    mockListSchemes.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000002",
        code: "AK3U",
        name: "Ahli K3 Umum",
        units: [{ code: "M.71KKK01.001.1", title: "Unit 1" }],
      },
    ]);
    mockGetAk05ReportForBatch.mockResolvedValue(null);
    mockListDriveFilesForBatch.mockResolvedValue([]);
    mockListDecisionsForAssessee.mockResolvedValue([]);
    mockGetAssesseeDecisionOverride.mockResolvedValue(null);
    mockGetLatestDitAnalysis.mockResolvedValue(null);
    mockGetLatestWrittenGrading.mockResolvedValue(null);
    mockGetLatestInterviewAssessment.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/export-pack"), {
      params: Promise.resolve({ id: BATCH_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 422 when assessor has no active signature", async () => {
    mockGetActiveSignature.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/export-pack"), {
      params: Promise.resolve({ id: BATCH_ID }),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error?.code).toBe("NO_ACTIVE_SIGNATURE");
  });

  it("bundles AK.05 + confirmed assessee forms into ZIP while skipping unconfirmed assessees honestly", async () => {
    mockListAssesseesByBatch.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000101",
        displayName: "Budi Santoso",
        certificateNameConfirmed: "BUDI SANTOSO",
        pseudonym: "ASESI-001",
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        displayName: "Citra Dewi",
        certificateNameConfirmed: null,
        pseudonym: "ASESI-002",
      },
    ]);
    mockResolveAk05BatchRows.mockResolvedValueOnce([
      {
        no: 1,
        assesseeId: "00000000-0000-4000-8000-000000000101",
        assesseeName: "BUDI SANTOSO",
        recommendation: "BK",
        keterangan: "BK pada unit 1",
        undecided: false,
      },
    ]);

    const res = await GET(new Request("http://localhost/export-pack"), {
      params: Promise.resolve({ id: BATCH_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain("Paket-Asesmen-Batch_K3_Uji.zip");

    const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
    const fileNames = Object.keys(zip.files);

    expect(fileNames).toContain("00-FR-AK-05-Laporan-Asesmen.pdf");
    expect(fileNames).toContain("00-FR-AK-05-Laporan-Asesmen.docx");
    expect(fileNames).toContain("01-BUDI_SANTOSO/FR-AK-02.docx");
    expect(fileNames).toContain("01-BUDI_SANTOSO/FR-IA-04A.docx");
    expect(fileNames).toContain("01-BUDI_SANTOSO/FR-IA-04B.docx");
    expect(fileNames).toContain("01-BUDI_SANTOSO/FR-IA-06C.docx");
    expect(fileNames.some((n) => n.includes("Citra"))).toBe(false);

    const readme = await zip.file("CATATAN_KELENGKAPAN.txt")!.async("string");
    expect(readme).toContain("BUDI SANTOSO (Folder: 01-BUDI_SANTOSO/, Putusan: BK)");
    expect(readme).toContain("Citra Dewi (Alasan: nama sertifikat KTP belum dikonfirmasi");
    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
  });
});
