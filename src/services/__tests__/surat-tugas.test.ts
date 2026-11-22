import { describe, expect, it } from "vitest";
import { extractIsoDateFromText, parseSuratTugasText } from "../surat-tugas";

describe("parseSuratTugasText", () => {
  it("extracts Indonesian assessment dates across supported formats", () => {
    expect(extractIsoDateFromText("Hari/Tanggal: Rabu, 18 November 2026")).toBe("2026-11-18");
    expect(extractIsoDateFromText("18/11/2026")).toBe("2026-11-18");
    expect(extractIsoDateFromText("2026-05-04")).toBe("2026-05-04");
    expect(extractIsoDateFromText("31 Februari 2026")).toBeNull();
  });

  it("extracts assessmentDate, TUK, letter number, assessor, and candidate roster", () => {
    const sample = `
      SURAT TUGAS ASESMEN KOMPETENSI
      Nomor Surat: ST-045/LSP-K3/XI/2026
      Tempat Uji Kompetensi (TUK): TUK Sewaktu PT Maju Jaya
      Hari/Tanggal Asesmen: Kamis, 19 November 2026
      Asesor Kompetensi: Budi Hartono, S.T. MET. 000.001234 2023

      DAFTAR PESERTA
      1. Andi Wijaya
      2. Siti Nurhaliza
      3. Rahmat Hidayat
    `;

    const parsed = parseSuratTugasText(sample);
    expect(parsed.letterNumber).toBe("ST-045/LSP-K3/XI/2026");
    expect(parsed.tukName).toBe("TUK Sewaktu PT Maju Jaya");
    expect(parsed.assessmentDate).toBe("2026-11-19");
    expect(parsed.assessorName).toBe("Budi Hartono, S.T.");
    expect(parsed.candidateNames).toEqual([
      "Andi Wijaya",
      "Siti Nurhaliza",
      "Rahmat Hidayat",
    ]);
  });

  it("ignores Tempat/Tanggal Lahir lines when falling back and returns nulls gracefully", () => {
    const parsed = parseSuratTugasText("Tempat/Tanggal Lahir: Jakarta, 12 Januari 1995\nDokumen internal.");
    expect(parsed.assessmentDate).toBeNull();
    expect(parsed.tukName).toBeNull();
    expect(parsed.candidateNames).toEqual([]);
  });
});
