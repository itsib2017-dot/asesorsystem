import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockCheckRateLimit,
  mockGetBatchById,
  mockListDriveFilesForBatch,
  mockDownloadPublicDriveFileBuffer,
  mockWriteAuditLog,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockGetBatchById: vi.fn(),
  mockListDriveFilesForBatch: vi.fn(),
  mockDownloadPublicDriveFileBuffer: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth/get-session", () => ({ getUser: mockGetUser }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }));
vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mockGetBatchById,
  listDriveFilesForBatch: mockListDriveFilesForBatch,
}));
vi.mock("@/services/drive-extract", () => ({
  downloadPublicDriveFileBuffer: mockDownloadPublicDriveFileBuffer,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock("@/lib/audit/write-audit-log", () => ({ writeAuditLog: mockWriteAuditLog }));

import { GET } from "../route";

const USER_ID = "00000000-0000-4000-8000-000000000010";
const BATCH_ID = "00000000-0000-4000-8000-000000000020";
const OTHER_BATCH_ID = "00000000-0000-4000-8000-000000000099";
const FILE_ID = "00000000-0000-4000-8000-000000000030";

describe("GET /api/v1/batches/[id]/files/[fileId]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: USER_ID, email: "asesor@lsp.test" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    mockGetBatchById.mockResolvedValue({
      id: BATCH_ID,
      lspId: "00000000-0000-4000-8000-000000000001",
      name: "Batch Uji",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/test"), {
      params: Promise.resolve({ id: BATCH_ID, fileId: FILE_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid UUID parameters", async () => {
    const res = await GET(new Request("http://localhost/test"), {
      params: Promise.resolve({ id: "bad-id", fileId: FILE_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when file belongs to another batch (IDOR prevention)", async () => {
    mockListDriveFilesForBatch.mockResolvedValueOnce([
      {
        id: FILE_ID,
        batchId: OTHER_BATCH_ID,
        driveFileId: "drive-12345",
        fileName: "ktp.jpg",
        mimeType: "image/jpeg",
        docType: "ktp",
        extractedText: null,
      },
    ]);
    const res = await GET(new Request("http://localhost/test"), {
      params: Promise.resolve({ id: BATCH_ID, fileId: FILE_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns UTF-8 text attachment for manual files with extractedText", async () => {
    mockListDriveFilesForBatch.mockResolvedValueOnce([
      {
        id: FILE_ID,
        batchId: BATCH_ID,
        driveFileId: "manual-paste-1",
        fileName: "Manual 06B",
        mimeType: "text/plain",
        docType: "06b",
        extractedText: "1. Jawaban master uji",
      },
    ]);
    const res = await GET(new Request("http://localhost/test"), {
      params: Promise.resolve({ id: BATCH_ID, fileId: FILE_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain('filename="Manual 06B.txt"');
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await res.text()).toBe("1. Jawaban master uji");
    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
  });

  it("downloads and streams original Drive file bytes with safe attachment header", async () => {
    mockListDriveFilesForBatch.mockResolvedValueOnce([
      {
        id: FILE_ID,
        batchId: BATCH_ID,
        driveFileId: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
        fileName: "../../evil/ktp\"budi.jpg",
        mimeType: "image/jpeg",
        docType: "ktp",
        extractedText: null,
      },
    ]);
    const sampleBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    mockDownloadPublicDriveFileBuffer.mockResolvedValueOnce(sampleBytes);

    const res = await GET(new Request("http://localhost/test"), {
      params: Promise.resolve({ id: BATCH_ID, fileId: FILE_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="ktp_budi.jpg"',
    );
    expect(Buffer.from(await res.arrayBuffer())).toEqual(sampleBytes);
    expect(mockDownloadPublicDriveFileBuffer).toHaveBeenCalledTimes(1);
  });
});
