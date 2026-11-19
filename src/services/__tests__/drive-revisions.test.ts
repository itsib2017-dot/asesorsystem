import { describe, expect, it } from "vitest";
import {
  compareDriveFileFreshnessDesc,
  deduplicateFilesByLatestRevision,
  extractDateMsFromFileName,
  extractMultiPartSlotKey,
  pickLatestDriveFile,
} from "../drive-revisions";

describe("Drive Revision Freshness & Multi-Part Grouping", () => {
  it("extracts embedded ISO, DD-MM-YYYY, compact, and Indonesian month dates from filenames", () => {
    expect(extractDateMsFromFileName("FR.IA.06C_2026-11-18.docx")).toBe(
      Date.UTC(2026, 10, 18),
    );
    expect(extractDateMsFromFileName("Jawaban_19-11-2026.pdf")).toBe(
      Date.UTC(2026, 10, 19),
    );
    expect(extractDateMsFromFileName("Revisi 19 Nov 2026.docx")).toBe(
      Date.UTC(2026, 10, 19),
    );
  });

  it("always selects the newest file revision using modifiedTime first, then date/rev tags", () => {
    const older = {
      id: "old",
      fileName: "FR.IA.06C Jawaban.pdf",
      docType: "06c",
      driveModifiedTime: "2026-11-17T08:00:00.000Z",
    };
    const newer = {
      id: "new",
      fileName: "FR.IA.06C Jawaban Revisi.pdf",
      docType: "06c",
      driveModifiedTime: "2026-11-19T02:00:00.000Z",
    };

    expect(pickLatestDriveFile([older, newer])?.id).toBe("new");

    // When keyless HTML crawl omits driveModifiedTime, filename date & revision markers decide cleanly
    const v1 = { id: "v1", fileName: "FR.IA.06C_18-11-2026.docx", docType: "06c" };
    const v2 = { id: "v2", fileName: "FR.IA.06C_Revisi_19-11-2026.docx", docType: "06c" };
    expect(pickLatestDriveFile([v1, v2])?.id).toBe("v2");

    const plain = { id: "plain", fileName: "FR.IA.06C.pdf", docType: "06c" };
    const rev2 = { id: "rev2", fileName: "FR.IA.06C_v2_Final.pdf", docType: "06c" };
    expect([plain, rev2].sort(compareDriveFileFreshnessDesc)[0]?.id).toBe("rev2");
  });

  it("deduplicates duplicate copies of the same slot while preserving distinct Kelompok Pekerjaan & DIT forms", () => {
    const lumikaDuplicates = [
      { id: "k1-orig", fileName: "FR_IA_04A_Kelompok_1_LUMIKA.pptx", docType: "04a", driveModifiedTime: "2026-11-18T01:00:00Z" },
      { id: "k1-1", fileName: "FR_IA_04A_Kelompok_1_LUMIKA (1).pptx", docType: "04a", driveModifiedTime: "2026-11-18T02:00:00Z" },
      { id: "k1-4", fileName: "FR_IA_04A_Kelompok_1_LUMIKA (4).pptx", docType: "04a", driveModifiedTime: "2026-11-18T05:00:00Z" },
    ];
    const dedupedLumika = deduplicateFilesByLatestRevision(lumikaDuplicates);
    expect(dedupedLumika).toHaveLength(1);
    expect(dedupedLumika[0]?.id).toBe("k1-4");

    const wiwikMultiPart = [
      { id: "p1", fileName: "PEKERJAAN 1.pptx", docType: "04b" },
      { id: "p2", fileName: "PEKERJAAN 2.pptx", docType: "04b" },
      { id: "p3", fileName: "PEKERJAAN 3.pptx", docType: "04b" },
      { id: "p4", fileName: "PEKERJAAN 4.pptx", docType: "04b" },
      { id: "f1", fileName: "1. Form IBPR-HIRADC AK3U.docx", docType: "dit_form" },
      { id: "f2", fileName: "2. Form ERP.docx", docType: "dit_form" },
      { id: "f3", fileName: "3. Form Work Permit.docx", docType: "dit_form" },
      { id: "f4", fileName: "4. Form Inspeksi P3K.docx", docType: "dit_form" },
      { id: "f5", fileName: "5. Form Investigasi.docx", docType: "dit_form" },
    ];
    expect(extractMultiPartSlotKey(wiwikMultiPart[0]!)).toBe("04b:part-1");
    expect(extractMultiPartSlotKey(wiwikMultiPart[4]!)).toBe("dit_form:ibpr");
    expect(deduplicateFilesByLatestRevision(wiwikMultiPart)).toHaveLength(9);
  });
});
