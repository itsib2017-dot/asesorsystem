import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getBatchById: vi.fn(),
  getActiveSignature: vi.fn(),
  listAssesseesByBatch: vi.fn(),
  getAssessorProfile: vi.fn(),
  listSchemes: vi.fn(),
  getAk05ReportForBatch: vi.fn(),
  resolveAk05BatchRows: vi.fn(),
  generateAk05Pdf: vi.fn(),
  generateAk05Docx: vi.fn(),
  resolveSchemeTemplateBuffer: vi.fn(),
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/get-session", () => ({ getUser: mocks.getUser }));
vi.mock("@/repositories/batches.repository", () => ({ getBatchById: mocks.getBatchById }));
vi.mock("@/repositories/signatures.repository", () => ({
  getActiveSignature: mocks.getActiveSignature,
}));
vi.mock("@/repositories/assessees.repository", () => ({
  listAssesseesByBatch: mocks.listAssesseesByBatch,
}));
vi.mock("@/repositories/auth.repository", () => ({
  getAssessorProfile: mocks.getAssessorProfile,
}));
vi.mock("@/repositories/schemes.repository", () => ({ listSchemes: mocks.listSchemes }));
vi.mock("@/repositories/assessment.repository", () => ({
  getAk05ReportForBatch: mocks.getAk05ReportForBatch,
}));
vi.mock("@/lib/ak05/rollup", () => ({ resolveAk05BatchRows: mocks.resolveAk05BatchRows }));
vi.mock("@/services/export", () => ({
  generateAk05Pdf: mocks.generateAk05Pdf,
  generateAk05Docx: mocks.generateAk05Docx,
  resolveSchemeTemplateBuffer: mocks.resolveSchemeTemplateBuffer,
  validateExportFormat: (_form: string, format: string) =>
    format === "pdf" || format === "docx"
      ? { allowed: true }
      : { allowed: false, reason: "Format tidak didukung." },
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));

const BATCH_ID = "6d577c84-844e-47ae-a170-47fada8e13e2";
const ASESI_1 = "11111111-1111-4111-8111-111111111111";
const ASESI_2 = "22222222-2222-4222-8222-222222222222";
const LSP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("GET /api/v1/batches/[id]/ak05/export", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue({ id: "user-1", email: "asesor@lsp.id" });
    mocks.getBatchById.mockResolvedValue({
      id: BATCH_ID,
      lspId: LSP_ID,
      schemeId: "scheme-1",
      tukName: "TUK Sewaktu",
      tukType: "sewaktu",
      assessmentDate: "2026-11-26",
    });
    mocks.getActiveSignature.mockResolvedValue({
      storagePath: "sig/u1.png",
      mimeType: "image/png",
      signedUrl: null,
    });
    mocks.getSupabaseServerClient.mockResolvedValue({
      storage: {
        from: () => ({
          download: async () => ({
            data: new Blob([new Uint8Array([137, 80, 78, 71])]),
          }),
        }),
      },
    });
    mocks.listAssesseesByBatch.mockResolvedValue([
      {
        id: ASESI_1,
        displayName: "Asesi Satu",
        pseudonym: "ASESI-001",
        certificateNameConfirmed: null,
      },
      {
        id: ASESI_2,
        displayName: "Asesi Dua",
        pseudonym: "ASESI-002",
        certificateNameConfirmed: "Asesi Dua Resmi",
      },
    ]);
    mocks.getAssessorProfile.mockResolvedValue({
      fullName: "Daniel Stefanus",
      regNoMet: "MET.000.003610",
    });
    mocks.listSchemes.mockResolvedValue([
      {
        id: "scheme-1",
        code: "AK3U",
        name: "Ahli K3 Umum",
        manifest: { units: [{ code: "U1", title: "Unit 1" }] },
      },
    ]);
    mocks.getAk05ReportForBatch.mockResolvedValue(null);
    mocks.resolveSchemeTemplateBuffer.mockResolvedValue(undefined);
    mocks.resolveAk05BatchRows.mockImplementation(
      async (_u: string, _b: string, list: Array<{ id: string; displayName: string }>) =>
        list.map((a, idx) => ({
          no: idx + 1,
          assesseeId: a.id,
          assesseeName: a.displayName,
          recommendation: "BK",
          keterangan: "Unit belum lengkap",
          undecided: false,
        })),
    );
    mocks.generateAk05Pdf.mockResolvedValue(Buffer.from("%PDF-1.4\n%%EOF"));
    mocks.generateAk05Docx.mockResolvedValue(Buffer.from("PK\x03\x04docx"));
  });

  it("denies unauthenticated requests with 401", async () => {
    mocks.getUser.mockResolvedValueOnce(null);
    const { GET } = await import("../route");
    const res = await GET(new Request(`https://app.test/api/v1/batches/${BATCH_ID}/ak05/export`), {
      params: Promise.resolve({ id: BATCH_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects malformed assesseeId query parameter with 400", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      new Request(
        `https://app.test/api/v1/batches/${BATCH_ID}/ak05/export?format=pdf&assesseeId=not-a-uuid`,
      ),
      { params: Promise.resolve({ id: BATCH_ID }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when assesseeId does not belong to the batch", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      new Request(
        `https://app.test/api/v1/batches/${BATCH_ID}/ak05/export?format=pdf&assesseeId=99999999-9999-4999-8999-999999999999`,
      ),
      { params: Promise.resolve({ id: BATCH_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it("exports AK.05 PDF and DOCX for confirmed ASESI-002 even when ASESI-001 is unconfirmed (P0-3)", async () => {
    const { GET } = await import("../route");

    const pdfRes = await GET(
      new Request(
        `https://app.test/api/v1/batches/${BATCH_ID}/ak05/export?format=pdf&assesseeId=${ASESI_2}`,
      ),
      { params: Promise.resolve({ id: BATCH_ID }) },
    );
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type")).toBe("application/pdf");
    expect(pdfRes.headers.get("content-disposition")).toContain("ASESI-002.pdf");
    expect(mocks.resolveAk05BatchRows).toHaveBeenCalledWith(
      "user-1",
      BATCH_ID,
      [expect.objectContaining({ id: ASESI_2 })],
      expect.anything(),
    );

    const docxRes = await GET(
      new Request(
        `https://app.test/api/v1/batches/${BATCH_ID}/ak05/export?format=docx&assesseeId=${ASESI_2}`,
      ),
      { params: Promise.resolve({ id: BATCH_ID }) },
    );
    expect(docxRes.status).toBe(200);
    expect(docxRes.headers.get("content-disposition")).toContain("ASESI-002.docx");
  });

  it("blocks per-assessee AK.05 export (422) if that specific assessee lacks KTP name confirmation", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      new Request(
        `https://app.test/api/v1/batches/${BATCH_ID}/ak05/export?format=pdf&assesseeId=${ASESI_1}`,
      ),
      { params: Promise.resolve({ id: BATCH_ID }) },
    );
    expect(res.status).toBe(422);
  });

  it("keeps batch-wide AK.05 export blocked (422) when any assessee is unconfirmed", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      new Request(`https://app.test/api/v1/batches/${BATCH_ID}/ak05/export?format=pdf`),
      { params: Promise.resolve({ id: BATCH_ID }) },
    );
    expect(res.status).toBe(422);
  });
});
