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

  it("extracts assessor from 'Menugaskan kepada' and MET lines, normalizes spaced letter numbers, cleans room from TUK, handles date ranges, and extracts all participants across inline and multiline tables", () => {
    const sample = `
      BADAN NASIONAL SERTIFIKASI PROFESI
      SURAT TUGAS
      Nomor Surat: 045 / ST - LSP K3 / X I / 20 26   Perihal: Tugas Asesmen
      Menugaskan kepada:
      Nama Lengkap: Ir. Siti Rahmawati, M.T.
      No. Reg. MET. 000.004512 2024
      Tempat Uji Kompetensi (TUK): TUK Sewaktu Gedung Graha K3 (Ruang Meeting B, Lantai 2)
      Tanggal Pelaksanaan: 18 - 19 November 2026

      DAFTAR ASESI
      1. Ahmad Fauzi | PT Beta   2. Rina Marlina | PT Gamma
    `;

    const parsed = parseSuratTugasText(sample);
    expect(parsed.letterNumber).toBe("045/ST-LSP K3/XI/2026");
    expect(parsed.assessorName).toBe("Ir. Siti Rahmawati, M.T.");
    expect(parsed.tukName).toBe("TUK Sewaktu Gedung Graha K3");
    expect(parsed.assessmentDate).toBe("2026-11-18");
    expect(parsed.candidateNames).toEqual(["Ahmad Fauzi", "Rina Marlina"]);
  });

  it("strips comma/dash room qualifiers on TUK and parses DOCX cell-per-line participant tables", () => {
    const sample = `
      SURAT TUGAS ASESOR
      No. ST-102/LSP/2026
      Asesor:
      Hendra Wijaya
      MET. 000.009876 2025
      TUK: TUK Mandiri Kampus Vokasi, Ruang Aula Utama Lantai 3
      Hari/Tanggal: 5 s.d. 6 Desember 2026

      DAFTAR PESERTA
      1.
      Dewi Anggraini
      2.
      Bagus Prasetyo
    `;

    const parsed = parseSuratTugasText(sample);
    expect(parsed.assessorName).toBe("Hendra Wijaya");
    expect(parsed.tukName).toBe("TUK Mandiri Kampus Vokasi");
    expect(parsed.assessmentDate).toBe("2026-12-05");
    expect(parsed.candidateNames).toEqual(["Dewi Anggraini", "Bagus Prasetyo"]);
  });
});
