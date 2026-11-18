import { describe, expect, it, vi, afterEach } from "vitest";
import JSZip from "jszip";
import zlib from "node:zlib";

const mocks = vi.hoisted(() => ({
  updateDriveFileExtraction: vi.fn(),
}));

vi.mock("@/repositories/batches.repository", () => ({
  updateDriveFileExtraction: mocks.updateDriveFileExtraction,
}));

import {
  extractTextFromBuffer,
  extractTextFromPdfBasic,
  isOleEncryptedBuffer,
} from "../extract";
import {
  downloadPublicDriveFileBuffer,
  ensureDriveFileExtracted,
} from "../drive-extract";

describe("File text extraction & SSRF-guarded Drive download (T2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("extracts PPTX slide & notes XML cleanly via extractTextFromBuffer", async () => {
    const zip = new JSZip();
    zip.file(
      "ppt/slides/slide1.xml",
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>Identifikasi Bahaya K3</a:t></p:sld>`,
    );
    const buf = await zip.generateAsync({ type: "nodebuffer" });

    const out = await extractTextFromBuffer({
      buffer: buf,
      fileName: "Presentasi_Andi.pptx",
    });
    expect(out.extractionMethod).toBe("ooxml_pptx");
    expect(out.text).toContain("Identifikasi Bahaya K3");
  });

  it("extracts basic FlateDecode PDF text layer and returns empty on scanned/binary PDF", () => {
    const contentStream = Buffer.from("BT (Curriculum Vitae Budi Santoso K3) Tj ET", "latin1");
    const deflated = zlib.deflateSync(contentStream);
    const fakePdf = Buffer.concat([
      Buffer.from("%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n", "latin1"),
      deflated,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);

    expect(extractTextFromPdfBasic(fakePdf)).toContain("Curriculum Vitae Budi Santoso K3");
    expect(extractTextFromPdfBasic(Buffer.from("not a pdf"))).toBe("");
  });

  it("rejects OLE encrypted OOXML buffers with KEY_ENCRYPTED", async () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
    expect(isOleEncryptedBuffer(ole)).toBe(true);
    await expect(
      extractTextFromBuffer({ buffer: ole, fileName: "FR.IA.06B.docx" }),
    ).rejects.toThrow("KEY_ENCRYPTED");
  });

  it("rejects invalid driveFileId and SSRF redirect targets", async () => {
    await expect(
      downloadPublicDriveFileBuffer({ driveFileId: "../etc/passwd" }),
    ).rejects.toThrow("INVALID_DRIVE_FILE_ID");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1:8080/internal" },
      }),
    );

    await expect(
      downloadPublicDriveFileBuffer({ driveFileId: "1avZ7_cSFIZucgYFDokGGg9-MpL4YrQhs" }),
    ).rejects.toThrow("SSRF_BLOCKED");
  });

  it("follows allowed Google Drive redirect and persists extracted text on demand", async () => {
    const zip = new JSZip();
    zip.file(
      "ppt/slides/slide1.xml",
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>Presentasi Proyek DIT</a:t></p:sld>`,
    );
    const pptxBuf = await zip.generateAsync({ type: "nodebuffer" });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 303,
          headers: {
            location: "https://drive.usercontent.google.com/download?id=abc1234567890",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array(pptxBuf), {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        }),
      );

    mocks.updateDriveFileExtraction.mockResolvedValueOnce(undefined);

    const out = await ensureDriveFileExtracted({
      userId: "user-1",
      file: {
        id: "db-file-1",
        lspId: "lsp-1",
        batchId: "batch-1",
        assesseeId: "as-1",
        driveFileId: "abc1234567890",
        fileName: "Presentasi_DIT.pptx",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        drivePath: "Tugas DIT/Presentasi_DIT.pptx",
        docType: "04b",
        classificationConfidence: 0.9,
        triageStatus: "assigned",
        triageReason: null,
        extractedText: null,
        extractionMethod: null,
        ocrConfidence: null,
      },
    });

    expect(out.text).toContain("Presentasi Proyek DIT");
    expect(out.extractionMethod).toBe("ooxml_pptx");
    expect(mocks.updateDriveFileExtraction).toHaveBeenCalledWith({
      userId: "user-1",
      fileId: "db-file-1",
      extractedText: "[ppt/slides/slide1.xml] Presentasi Proyek DIT",
      extractionMethod: "ooxml_pptx",
    });
  });

  it("rejects HTML interstitials and oversized Drive downloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html>Sign in</html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    await expect(
      downloadPublicDriveFileBuffer({ driveFileId: "abc1234567890" }),
    ).rejects.toThrow("DRIVE_HTML_INTERSTITIAL");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(Buffer.alloc(100), {
        status: 200,
        headers: { "content-type": "application/octet-stream", "content-length": "99999999" },
      }),
    );

    await expect(
      downloadPublicDriveFileBuffer({ driveFileId: "abc1234567890", maxBytes: 1024 }),
    ).rejects.toThrow("FILE_TOO_LARGE");
  });
});
