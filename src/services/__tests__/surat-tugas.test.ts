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

  it("extracts all 5 fields cleanly from real BNSP Surat Tugas PDF fixtures (fragmented 1623-char, flat single-line, and coordinate-reconstructed)", () => {
    const fragmented1623 = [
      "GoWork Lippo Mall Puri, unit GF 101",
      "Jl. Puri Indah Raya Blok U1 CBD, Jakarta Barat 11610",
      "BNSP",
      "-",
      "LSP",
      "-",
      "2037",
      "-",
      "ID",
      "Jakarta",
      ",",
      "17",
      "November",
      "2026",
      "Ketua",
      "SURAT",
      "TUGAS",
      "ASESMEN",
      "Nomor:",
      "3",
      "801",
      "/",
      "ST/LSP",
      "-",
      "K3N/",
      "X",
      "I",
      "/20",
      "2",
      "6",
      "Dasar",
      ":",
      "Pedoman",
      "Badan",
      "Nasional",
      "Sertifikasi",
      "Profesi",
      "(BNSP)",
      "201",
      "Sehubungan",
      "dengan",
      "pelaksanaan",
      "Uji",
      "Kompetensi",
      "di",
      "lingkungan",
      "Lembaga",
      "Sertifikasi",
      "Profesi",
      "K3",
      "Nasional",
      "maka",
      "dengan",
      "ini",
      "Ketua",
      "LSP",
      "K3 Nasional",
      "menugaskan",
      "kepada",
      "nama dibawah ini:",
      "No.",
      "Nama",
      "No.",
      "Reg.",
      "Skema",
      "Uji",
      "Kompetensi",
      "Nama",
      "Asesi",
      "1.",
      "Daniel Stefanus",
      "MET. 000.003610 2023",
      "Ahli Keselamatan dan",
      "Kesehatan Kerja Umum",
      "Terlampir",
      "Untuk:",
      "1.",
      "Menjadi",
      "Tim",
      "Asesor",
      "Kompetensi",
      "pada",
      "Uji",
      "Kompetensi",
      "sesuai",
      "Skema.",
      "2.",
      "Mempersiapkan",
      "Perangkat",
      "Kerja",
      "Asesor dan",
      "Perangkat Asesmen",
      "sesuai",
      "skemanya.",
      "3.",
      "Melaksanakan",
      "Uji",
      "Kompetensi",
      "dengan",
      "sebaik",
      "-",
      "baiknya",
      "pada,",
      "Tanggal",
      ":",
      "19",
      "November",
      "2026",
      "TUK",
      ":",
      "TUK",
      "Sewaktu",
      "LSP",
      "K3",
      "Nasional",
      "-",
      "PT Mairodi Mandiri Sejahtera",
      "Nama Ruang",
      ": Ruang Uji",
      "Alamat",
      ":",
      "Gedung Dapenpos Lantai 2, Jl. Phh. Mustofa No. 35 Neglasari",
      "Cibeunying Kaler, Kota Bandung 40124",
      "P",
      "ukul",
      ":",
      "08",
      ".",
      "0",
      "0",
      "WIB",
      "Selesai",
      "4.",
      "Melaporkan hasil Uji Kompetensi kepada",
      "Ketua LSP K3 Nasional selambat lambatnya 3 hari setelah",
      "pelaksanaan",
      "uji",
      "kompetensi.",
      "Thomas",
      "R.",
      "Mardadi",
      "GoWork Lippo Mall Puri, unit GF 101",
      "Jl. Puri Indah Raya Blok U1 CBD, Jakarta Barat 11610",
      "BNSP",
      "-",
      "LSP",
      "-",
      "2037",
      "-",
      "ID",
      "Lampiran",
      ": Daftar Peserta Uji Kompetensi",
      "No.",
      "Surat",
      "Tugas",
      ":",
      "3",
      "801",
      "/ST/LSP",
      "-",
      "K3N",
      "/X",
      "I",
      "/202",
      "6",
      "DAFTAR PESERTA",
      "UJI",
      "KOMPETENSI",
      "Skema",
      ":",
      "Ahli Keselamatan dan Kesehatan Kerja Umum",
      "TUK",
      ":",
      "Sewaktu LSP K3 Nasional",
      "-",
      "PT Mairodi Mandiri Sejahtera",
      "Tanggal",
      "Uji",
      "Kompetensi",
      ":",
      "19 November 2026",
      "NO",
      "NAMA",
      "ORGANISASI",
      "1",
      "Aryanto",
      "-",
      "2",
      "S",
      "uhartono",
      "-",
    ].join("\n");

    const flatSingleLine = fragmented1623.replace(/\n/g, " ");

    const coordinateReconstructed = [
      "BNSP -LSP -2037-ID",
      "SURAT TUGAS ASESMEN",
      "Nomor: 3801/ST/LSP-K3N/XI/2026",
      "Dasar: Pedoman Badan Nasional Sertifikasi Profesi (BNSP) 201",
      "Sehubungan dengan pelaksanaan Uji Kompetensi di lingkungan Lembaga Sertifikasi Profesi K3 Nasional maka",
      "dengan ini Ketua LSP K3 Nasional menugaskan kepada nama dibawah ini:",
      "No. Nama No. Reg. Skema Uji Kompetensi Nama Asesi",
      "1. Daniel Stefanus MET. 000.003610 2023 Ahli Keselamatan dan Terlampir",
      "Kesehatan Kerja Umum",
      "Untuk:",
      "1. Menjadi Tim Asesor Kompetensi pada Uji Kompetensi sesuai Skema.",
      "2. Mempersiapkan Perangkat Kerja Asesor dan Perangkat Asesmen sesuai skemanya.",
      "3. Melaksanakan Uji Kompetensi dengan sebaik-baiknya pada,",
      "Tanggal : 19 November 2026",
      "TUK : TUK Sewaktu LSP K3 Nasional - PT Mairodi Mandiri Sejahtera",
      "Nama Ruang : Ruang Uji",
      "Alamat : Gedung Dapenpos Lantai 2, Jl. Phh. Mustofa No. 35 Neglasari",
      "Cibeunying Kaler, Kota Bandung 40124",
      "Pukul : 08.00 WIB Selesai",
      "4. Melaporkan hasil Uji Kompetensi kepada Ketua LSP K3 Nasional selambat lambatnya 3 hari setelah",
      "pelaksanaan uji kompetensi.",
      "Jakarta, 17 November 2026",
      "Ketua",
      "Thomas R. Mardadi",
      "GoWork Lippo Mall Puri, unit GF 101",
      "Jl. Puri Indah Raya Blok U1 CBD, Jakarta Barat 11610",
      "BNSP -LSP -2037-ID",
      "Lampiran : Daftar Peserta Uji Kompetensi",
      "No. Surat Tugas : 3801/ST/LSP-K3N/XI/2026",
      "DAFTAR PESERTA",
      "UJI KOMPETENSI",
      "Skema : Ahli Keselamatan dan Kesehatan Kerja Umum",
      "TUK : Sewaktu LSP K3 Nasional - PT Mairodi Mandiri Sejahtera",
      "Tanggal Uji Kompetensi : 19 November 2026",
      "NO NAMA ORGANISASI",
      "1 Aryanto -",
      "2 Suhartono -",
      "GoWork Lippo Mall Puri, unit GF 101",
      "Jl. Puri Indah Raya Blok U1 CBD, Jakarta Barat 11610",
    ].join("\n");

    for (const fixtureText of [fragmented1623, flatSingleLine, coordinateReconstructed]) {
      const parsed = parseSuratTugasText(fixtureText);
      expect(parsed.assessmentDate).toBe("2026-11-19");
      expect(parsed.letterNumber).toBe("3801/ST/LSP-K3N/XI/2026");
      expect(parsed.tukName).toBe("TUK Sewaktu LSP K3 Nasional - PT Mairodi Mandiri Sejahtera");
      expect(parsed.assessorName).toBe("Daniel Stefanus");
      expect(parsed.candidateNames).toEqual(["Aryanto", "Suhartono"]);
    }
  });

  it("extracts all participants across multiple scheme tables in one Surat Tugas (3897 multi-scheme)", () => {
    const multiScheme = `
      SURAT TUGAS ASESMEN
      Nomor: 3897/ST/LSP-K3N/XI/2026
      No. Nama No. Reg. Skema Uji Kompetensi Nama Asesi
      1. Daniel Stefanus MET. 000.003610 2023 - Ahli Keselamatan dan Kesehatan Kerja Umum - Operator Keselamatan dan Kesehatan Kerja Terlampir
      Tanggal : 26 November 2026
      TUK : TUK Sewaktu LSP K3 Nasional - PT Patrari Jaya Utama
      DAFTAR PESERTA
      UJI KOMPETENSI
      Skema : Ahli Keselamatan dan Kesehatan Kerja Umum
      TUK : Sewaktu LSP K3 Nasional - PT Patrari Jaya Utama
      Tanggal Uji Kompetensi : 26 November 2026
      NO NAMA ORGANISASI
      1 Amin Fauzi -
      2 Ady M Ramadhan -
      3 Silvia Yopi Putri Mila -
      Skema : Operator Keselamatan dan Kesehatan Kerja
      TUK : Sewaktu LSP K3 Nasional - PT Patrari Jaya Utama
      Tanggal Uji Kompetensi : 26 November 2026
      NO NAMA ORGANISASI
      1 Aji Caya Dika -
      2 Bram Juminarko -
      3 Ricky Razab -
      4 Gusti Roni -
      GoWork Lippo Mall Puri, unit GF 101
    `;

    const parsed = parseSuratTugasText(multiScheme);
    expect(parsed.letterNumber).toBe("3897/ST/LSP-K3N/XI/2026");
    expect(parsed.assessmentDate).toBe("2026-11-26");
    expect(parsed.tukName).toBe("TUK Sewaktu LSP K3 Nasional - PT Patrari Jaya Utama");
    expect(parsed.assessorName).toBe("Daniel Stefanus");
    expect(parsed.candidateNames).toEqual([
      "Amin Fauzi",
      "Ady M Ramadhan",
      "Silvia Yopi Putri Mila",
      "Aji Caya Dika",
      "Bram Juminarko",
      "Ricky Razab",
      "Gusti Roni",
    ]);
    expect(parsed.schemeGroups).toEqual([
      {
        schemeName: "Ahli Keselamatan dan Kesehatan Kerja Umum",
        candidateNames: ["Amin Fauzi", "Ady M Ramadhan", "Silvia Yopi Putri Mila"],
      },
      {
        schemeName: "Operator Keselamatan dan Kesehatan Kerja",
        candidateNames: ["Aji Caya Dika", "Bram Juminarko", "Ricky Razab", "Gusti Roni"],
      },
    ]);
  });
});
