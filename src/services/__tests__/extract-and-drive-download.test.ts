import { describe, expect, it, vi, afterEach } from "vitest";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import zlib from "node:zlib";

const mocks = vi.hoisted(() => ({
  updateDriveFileExtraction: vi.fn(),
  updateDriveFileClassification: vi.fn(),
}));

vi.mock("@/repositories/batches.repository", () => ({
  updateDriveFileExtraction: mocks.updateDriveFileExtraction,
  updateDriveFileClassification: mocks.updateDriveFileClassification,
}));

import {
  extractTextFromBuffer,
  extractTextFromPdfBasic,
  isEncryptedZipBuffer,
  isOleEncryptedBuffer,
  repairBrokenZipCrcBuffer,
  unpackSafeZipEntries,
} from "../extract";
import {
  downloadPublicDriveFileBuffer,
  enrichFilesByContent,
  ensureDriveFileExtracted,
  extractDriveVirusScanConfirmUrl,
  reclassifyBatchFilesByContent,
  resolveAssesseeDitInputs,
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

  it("preserves reading order and line breaks across mixed Tj, TJ, and Td/Tm operators", () => {
    const streamContent = [
      "BT",
      "1 0 0 1 50 760 Tm (Nomor: ST-045 / 2026) Tj",
      "0 -14 Td [(Nama) 20 ( Asesor) -200 (:) -200 (Budi Santoso)] TJ",
      "0 -14 Td (1. Peserta Pertama) Tj",
      "0 -14 Td [(2. Peserta) -180 (Kedua)] TJ",
      "ET",
    ].join("\n");
    const deflated = zlib.deflateSync(Buffer.from(streamContent, "latin1"));
    const pdfBuf = Buffer.concat([
      Buffer.from("%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n", "latin1"),
      deflated,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);

    const extracted = extractTextFromPdfBasic(pdfBuf);
    const lines = extracted.split("\n");
    expect(lines).toEqual([
      "Nomor: ST-045 / 2026",
      "Nama Asesor : Budi Santoso",
      "1. Peserta Pertama",
      "2. Peserta Kedua",
    ]);
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
        driveModifiedTime: null,
        archiveParentId: null,
        archiveEntryPath: null,
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

  it("safely unpacks ZIP entries, blocks traversal paths, repairs broken OOXML CRC, and extracts ZIP child buffer (R8)", async () => {
    const zip = new JSZip();
    zip.file("Peserta/1. Budi/1. Form IBPR.txt", "Identifikasi Bahaya Potensial Lift Barang", {
      date: new Date("2026-11-18T10:00:00Z"),
    });
    zip.file("../../etc/passwd", "bad");
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });

    const entries = await unpackSafeZipEntries(zipBuf);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.entryPath).toBe("Peserta/1. Budi/1. Form IBPR.txt");
    expect(entries[0]?.modifiedTimeIso).toBe("2026-11-18T10:00:00.000Z");

    const repaired = await repairBrokenZipCrcBuffer(zipBuf);
    expect(repaired.subarray(0, 2).toString("utf8")).toBe("PK");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new Uint8Array(zipBuf), {
        status: 200,
        headers: { "content-type": "application/zip" },
      }),
    );

    const extractedChild = await downloadPublicDriveFileBuffer({
      driveFileId: "zipParent12345::Peserta/1. Budi/1. Form IBPR.txt",
    });
    expect(extractedChild.toString("utf8")).toContain("Identifikasi Bahaya");
  });

  it("aggregates multi-part DIT forms, picks newest duplicate revisions, and falls back to scheme 04A", async () => {
    const baseFile = {
      lspId: "lsp-1",
      batchId: "b-1",
      assesseeId: "a-1",
      mimeType: "application/pdf",
      drivePath: "Tugas DIT/Andi",
      classificationConfidence: 0.9,
      triageStatus: "assigned" as const,
      triageReason: null,
      extractionMethod: "cached",
      ocrConfidence: null,
      driveModifiedTime: null as string | null,
      archiveParentId: null as string | null,
      archiveEntryPath: null as string | null,
    };

    const resolved = await resolveAssesseeDitInputs({
      userId: "user-1",
      files: [
        {
          ...baseFile,
          id: "f-ibpr-old",
          driveFileId: "d1",
          fileName: "1. Form IBPR.pdf",
          docType: "dit_form",
          driveModifiedTime: "2026-11-10T00:00:00Z",
          extractedText: "IBPR versi lama",
        },
        {
          ...baseFile,
          id: "f-ibpr-new",
          driveFileId: "d2",
          fileName: "1. Form IBPR_Revisi.pdf",
          docType: "dit_form",
          driveModifiedTime: "2026-11-18T00:00:00Z",
          extractedText: "IBPR versi revisi terbaru",
        },
        {
          ...baseFile,
          id: "f-erp",
          driveFileId: "d3",
          fileName: "2. Form ERP.pdf",
          docType: "dit_form",
          extractedText: "Prosedur Tanggap Darurat Gedung",
        },
        {
          ...baseFile,
          id: "f-cv",
          driveFileId: "d4",
          fileName: "CV Andi.pdf",
          docType: "cv",
          extractedText: "Pengalaman HSE 5 tahun",
        },
      ],
      scheme: {
        id: "s-1",
        lspId: "lsp-1",
        code: "AK3U",
        name: "Ahli K3 Umum",
        version: 1,
        forms: [],
        manifest: {
          questionCounts: { official04bCount: 10, written06aCount: 10, questionBankCount: 10 },
          decisionRule: "VATM",
          decisionRuleRef: "SKKNI K3",
          prerequisites: [],
          registrationRequirements: [],
          units: [{ code: "M.71KKK01.001.1", title: "Merancang Strategi Pengendalian Risiko K3" }],
          formSuffixMapping: { soal: "06A", kunci: "06B", jawaban: "06C" },
        },
      },
    });

    expect(resolved.frIa04aSource).toBe("scheme");
    expect(resolved.frIa04aText).toContain("Kelompok Pekerjaan");
    expect(resolved.presentationTranscript).toContain("IBPR versi revisi terbaru");
    expect(resolved.presentationTranscript).not.toContain("IBPR versi lama");
    expect(resolved.presentationTranscript).toContain("Prosedur Tanggap Darurat Gedung");
    expect(resolved.candidateProfileSummary).toContain("Pengalaman HSE");
  });

  it("reclassifies unknown files by extracted text content in reclassifyBatchFilesByContent", async () => {
    mocks.updateDriveFileClassification.mockResolvedValue(undefined);
    const out = await reclassifyBatchFilesByContent({
      userId: "user-1",
      assessees: [{ id: "a-1", displayName: "Budi Santoso" }],
      files: [
        {
          id: "f-unk",
          lspId: "lsp-1",
          batchId: "b-1",
          assesseeId: null,
          driveFileId: "drive-unk-1",
          fileName: "Dokumen_Tanpa_Label.txt",
          mimeType: "text/plain",
          drivePath: "Lampiran/Dokumen_Tanpa_Label.txt",
          docType: "unknown",
          classificationConfidence: 0.4,
          triageStatus: "unmatched",
          triageReason: null,
          extractedText:
            "FR.APL.01 Permohonan Sertifikasi\nNama lengkap: Budi Santoso\nSkema AK3U",
          extractionMethod: "cached",
          ocrConfidence: null,
          driveModifiedTime: null,
          archiveParentId: null,
          archiveEntryPath: null,
        },
      ],
    });

    expect(out.reclassified).toBe(1);
    expect(out.reassigned).toBe(1);
    expect(mocks.updateDriveFileClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: "f-unk",
        docType: "apl01",
        assesseeId: "a-1",
        triageStatus: "assigned",
      }),
    );
  });

  it("follows Google Drive public virus-scan confirmation form and rejects encrypted ZIPs cleanly (R10 Cacat 4)", async () => {
    const confirmHtml = `<!DOCTYPE html><html><head><title>Google Drive - Virus scan warning</title></head><body><form id="download-form" action="https://drive.usercontent.google.com/download" method="get"><input type="hidden" name="id" value="1Jl1TfI9IC_FPA5wbl2aGVPjzR1brKg8p"><input type="hidden" name="export" value="download"><input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="test-uuid-123"></form></body></html>`;

    expect(
      extractDriveVirusScanConfirmUrl(
        confirmHtml,
        "https://drive.usercontent.google.com/download?id=1Jl1TfI9IC_FPA5wbl2aGVPjzR1brKg8p",
      ),
    ).toBe(
      "https://drive.usercontent.google.com/download?id=1Jl1TfI9IC_FPA5wbl2aGVPjzR1brKg8p&export=download&confirm=t&uuid=test-uuid-123",
    );

    const zip = new JSZip();
    zip.file("FR.IA.06B.txt", "Kunci jawaban tertulis");
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(confirmHtml, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array(zipBuf), {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        }),
      );

    const downloaded = await downloadPublicDriveFileBuffer({
      driveFileId: "1Jl1TfI9IC_FPA5wbl2aGVPjzR1brKg8p",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(downloaded.length).toBe(zipBuf.length);

    // Encrypted PKZIP header (PK\x03\x04 with general-purpose bit 0 set)
    const encryptedZipHeader = Buffer.from([
      0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x01, 0x00, 0x08, 0x00, 0x00, 0x00,
    ]);
    expect(isEncryptedZipBuffer(encryptedZipHeader)).toBe(true);
    await expect(unpackSafeZipEntries(encryptedZipHeader)).rejects.toThrow("ZIP_ENCRYPTED");
  });

  it("extracts high-confidence surat_tugas files during enrichFilesByContent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("SURAT TUGAS\nTanggal Pelaksanaan: 22 November 2026\nTUK: TUK Utama", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    const files = [
      {
        driveFileId: "stfile999999",
        fileName: "Surat_Tugas_2026.txt",
        mimeType: "text/plain",
        drivePath: "Surat_Tugas_2026.txt",
        docType: "surat_tugas",
        confidence: 0.92,
      },
    ];

    const stats = await enrichFilesByContent({
      files,
      persistUpdates: false,
      reassignAssessee: false,
    });

    expect(stats.inspected).toBe(1);
    expect(files[0]).toMatchObject({
      extractedText: expect.stringContaining("TUK Utama"),
    });
  });

  it("reconstructs Word-style multi-BT coordinates into visual lines and skips binary font streams", () => {
    const contentStream = [
      "/F1 11.04 Tf",
      // Out-of-order footer emitted at bottom (y=41) first
      "BT 1 0 0 1 71.904 41.04 Tm [(GoWork Lippo Mall)] TJ ET",
      // Top-of-page fragmented letter number spanning multiple BT/ET blocks on same y=707.02
      "BT 1 0 0 1 214.61 707.02 Tm (Nomor:) Tj ET",
      "BT 1 0 0 1 251.21 707.02 Tm (3) Tj ET",
      "BT 1 0 0 1 256.73 707.02 Tm (801) Tj ET",
      "BT 1 0 0 1 273.41 707.02 Tm (/ST/LSP-K3N/XI/2026) Tj ET",
      // Table row where index "2" sits 2.04pt lower than split name "S" + "uhartono"
      "BT 1 0 0 1 69.624 518.95 Tm (2) Tj ET",
      "BT 1 0 0 1 96.864 520.99 Tm (S) Tj ET",
      "BT 1 0 0 1 101.90 520.99 Tm (uhartono) Tj ET",
      "BT 1 0 0 1 429.34 520.99 Tm (-) Tj ET",
    ].join("\n");
    const fontBinaryStream = Buffer.from(
      "\x00\x01\x00\x00TrueTypeBinaryGarbage(fakeTj)Tj\x00\x00(fakeTJ)TJ",
      "latin1",
    );
    const pdfBuf = Buffer.concat([
      Buffer.from("%PDF-1.5\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n", "latin1"),
      zlib.deflateSync(Buffer.from(contentStream, "latin1")),
      Buffer.from("\nendstream\nendobj\n2 0 obj\n<< /Filter /FlateDecode >>\nstream\n", "latin1"),
      zlib.deflateSync(fontBinaryStream),
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);

    const lines = extractTextFromPdfBasic(pdfBuf).split("\n");
    expect(lines).toEqual([
      "Nomor: 3801/ST/LSP-K3N/XI/2026",
      "2 Suhartono -",
      "GoWork Lippo Mall",
    ]);
  });

  it("extracts ExcelJS richText/formula cells cleanly without [object Object] and deduplicates merged cells", async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("IBPR");
    sheet.addRow(["…..................", "…..................", "….................."]);
    sheet.addRow(["DEPARTEMEN :", "DEPARTEMEN :", "DEPARTEMEN :", "HSE"]);
    sheet.addRow(["DEPARTEMEN :", "DEPARTEMEN :", "DEPARTEMEN :", "HSE"]);
    sheet.addRow([
      { richText: [{ text: "Cleaning " }, { text: "Tanki" }] },
      { formula: "2*8", result: 16 },
      { text: "Risiko Tinggi", hyperlink: "https://example.com" },
    ]);
    const arrayBuf = await wb.xlsx.writeBuffer();
    const out = await extractTextFromBuffer({
      buffer: Buffer.from(arrayBuf),
      fileName: "IBR Cleaning Tanki.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    expect(out.extractionMethod).toBe("ooxml_xlsx");
    expect(out.text).not.toContain("[object Object]");
    expect(out.text).not.toContain("…..................");
    expect(out.text.split("\n")).toEqual([
      "--- Sheet: IBPR ---",
      "DEPARTEMEN : | HSE",
      "Cleaning Tanki | 16 | Risiko Tinggi",
    ]);
  });
});
