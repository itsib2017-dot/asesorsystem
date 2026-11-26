import { describe, expect, it } from "vitest";
import { parseMasterKeyByQuestion } from "../parse-key-items";

describe("parseMasterKeyByQuestion", () => {
  it("extracts numbered answer key entries across common Indonesian formats", () => {
    const sample = `
Kunci Jawaban FR.IA.06B
1. HIRADC disusun sebelum pekerjaan dimulai untuk mengidentifikasi bahaya.
Melibatkan pekerja lapangan dan supervisor K3.
2) LOTO wajib dipasang sebelum perawatan peralatan listrik.
Soal 3: Izin kerja panas berlaku 1 shift kerja.
Jawaban #4 - APAR ditempatkan maksimal setiap 15 meter.
    `;

    const parsed = parseMasterKeyByQuestion(sample);
    expect(parsed[1]).toContain("HIRADC disusun sebelum pekerjaan dimulai");
    expect(parsed[1]).toContain("supervisor K3");
    expect(parsed[2]).toContain("LOTO wajib dipasang");
    expect(parsed[3]).toContain("Izin kerja panas");
    expect(parsed[4]).toContain("APAR ditempatkan maksimal setiap 15 meter");
  });

  it("returns empty object safely for blank or unnumbered text", () => {
    expect(parseMasterKeyByQuestion("")).toEqual({});
    expect(parseMasterKeyByQuestion("Dokumen tanpa penomoran apa pun")).toEqual({});
  });
});
