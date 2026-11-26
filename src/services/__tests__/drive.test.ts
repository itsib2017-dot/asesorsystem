import { describe, expect, it, vi, afterEach } from "vitest";
import {
  classifyDocumentTextContent,
  classifyDriveFileName,
  cleanCandidateLabel,
  crawlPublicDriveFolder,
  explainNameInference,
  extractCandidateNamesFromDocumentText,
  hasTaskOrFolderPrefix,
  inferCandidateFromDrivePath,
  inferCandidateNameFromDrivePath,
} from "../drive";
import { findBestMatchingCandidate } from "@/lib/names";

describe("Drive folder crawling & BNSP path classification", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts candidate names from Persyaratan and Tugas DIT paths cleanly", () => {
    expect(
      inferCandidateNameFromDrivePath(
        "Persyaratan Pelatihan AK3 umum BNSP/1. Susilo Heni S. S.K.M/KTP Heni.jpg.jpeg",
        "KTP Heni.jpg.jpeg",
      ),
    ).toBe("Susilo Heni S. S.K.M");

    expect(
      inferCandidateNameFromDrivePath(
        "Pelatihan AK3/Tugas DIT/11. LINTANG SEPTYANJANI/DIT_Lintang.pptx",
        "DIT_Lintang.pptx",
      ),
    ).toBe("LINTANG SEPTYANJANI");

    expect(
      inferCandidateNameFromDrivePath(
        "Pelatihan AK3/Tugas DIT/TUGAS PRESENTASI DIT Dina Oktavia Anggriani.pptx",
        "TUGAS PRESENTASI DIT Dina Oktavia Anggriani.pptx",
      ),
    ).toBe("Dina Oktavia Anggriani");

    expect(
      inferCandidateNameFromDrivePath("Pelatihan AK3/Materi/Silabus.pdf", "Silabus.pdf"),
    ).toBeNull();
  });

  it("classifies standard BNSP filenames", () => {
    expect(classifyDriveFileName("KTP Heni.jpg.jpeg").docType).toBe("ktp");
    expect(classifyDriveFileName("FR.APL.01. PERMOHONAN.docx").docType).toBe("apl01");
    expect(classifyDriveFileName("FR.IA.06C Jawaban.docx").docType).toBe("06c");
  });

  it("classifies Materi PDFs as materi_pelatihan and avoids parent-folder false positives", () => {
    expect(
      classifyDriveFileName(
        "04. Ahli K3 U Komunikasi K3.pdf",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Materi",
      ).docType,
    ).toBe("materi_pelatihan");
    expect(
      classifyDriveFileName(
        "09. Ahli K3 U Evaluasi Pemenuhan persyaratan dan Prosedur K3.pdf",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Materi",
      ).docType,
    ).toBe("materi_pelatihan");
    expect(
      classifyDriveFileName(
        "FR_IA_04A_Kelompok_3_Komunikasi_Dokumentasi_K3.pptx",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT/Syaeful",
      ).docType,
    ).toBe("04a");
    expect(
      classifyDriveFileName(
        "Presentasi DIT - Andi Demo.pptx",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT",
      ).docType,
    ).toBe("04b");
    expect(
      classifyDriveFileName(
        "Andi Demo - Presentasi.pptx",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT",
      ).docType,
    ).toBe("04b");
    expect(
      classifyDriveFileName(
        "TUGAS PRESENTASI DIT Andi Demo.pptx",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT",
      ).docType,
    ).toBe("04b");
    expect(
      classifyDriveFileName(
        "DIT Andi Demo.pptx",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT",
      ).docType,
    ).toBe("04b");
    expect(
      classifyDriveFileName(
        "Andi Demo.pptx",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT",
      ).docType,
    ).toBe("04b");
    expect(
      classifyDriveFileName(
        "FR.IA.04B - Presentasi - Andi.docx",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT",
      ).docType,
    ).toBe("04b");
    expect(
      classifyDriveFileName(
        "Tugas_DIT_Andi.docx",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT/Andi",
      ).docType,
    ).toBe("04b");
    expect(
      classifyDriveFileName(
        "FR.IA.04A_Instruksi_DIT.docx",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT",
      ).docType,
    ).toBe("04a");
    expect(
      classifyDriveFileName("01. Pengantar Pelatihan K3.pdf", "").docType,
    ).toBe("materi_pelatihan");
    expect(
      classifyDriveFileName(
        "foto kiki.jpeg",
        "Persyaratan Pelatihan AK3 umum BNSP/10. Kiki Triyana",
      ).docType,
    ).toBe("pas_foto");
    expect(
      classifyDriveFileName(
        "ijasah.pdf",
        "Persyaratan Pelatihan AK3 umum BNSP/10. Kiki Triyana",
      ).docType,
    ).toBe("ijazah");
    expect(
      classifyDriveFileName(
        "Curiculum Vitae.pdf",
        "Persyaratan Pelatihan AK3 umum BNSP/11. Lintang",
      ).docType,
    ).toBe("cv");
    expect(
      classifyDriveFileName(
        "SK Kerja.pdf",
        "Persyaratan Pelatihan AK3 umum BNSP/12. Luat",
      ).docType,
    ).toBe("surat_tugas");
    expect(
      classifyDriveFileName(
        "DIT kelompok _1 IBPR.pptx",
        "Tugas DIT/WIWI",
      ).docType,
    ).toBe("04b");
    expect(
      classifyDriveFileName(
        "DIT_Kelompok_2_HIRADC_ERP.pptx",
        "Tugas DIT/Kelompok 2",
      ).docType,
    ).toBe("04b");
    expect(
      classifyDriveFileName(
        "IBPR_Area_Produksi.pdf",
        "Persyaratan/1. Budi",
      ).docType,
    ).toBe("dit_form");
    expect(
      classifyDriveFileName(
        "Paklaring_Pengalaman_Kerja_Budi.pdf",
        "Persyaratan/1. Budi",
      ).docType,
    ).toBe("portofolio");
  });

  it("falls back to keyless embeddedfolderview when API key returns 403", async () => {
    const html = `
      <div class="flip-entry" id="entry-sub1">
        <a href="https://drive.google.com/drive/folders/sub1">
          <div class="flip-entry-title">1. Budi Santoso</div>
        </a>
      </div>
    `;
    const subHtml = `
      <div class="flip-entry" id="entry-file1">
        <a href="https://drive.google.com/file/d/file1/view">
          <div class="flip-entry-title">KTP Budi.jpg</div>
        </a>
      </div>
    `;

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("googleapis.com/drive/v3/files")) {
        return new Response("Forbidden", { status: 403 });
      }
      if (url.includes("id=root1")) {
        return new Response(html, { status: 200 });
      }
      return new Response(subHtml, { status: 200 });
    });

    const files = await crawlPublicDriveFolder({
      folderId: "root1",
      apiKey: "restricted-key",
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      driveFileId: "file1",
      fileName: "KTP Budi.jpg",
      drivePath: "1. Budi Santoso/KTP Budi.jpg",
      docType: "ktp",
    });
  });

  it("skips inaccessible nested subfolders (HTTP 404) instead of aborting batch crawl", async () => {
    const rootHtml = `
      <div class="flip-entry" id="entry-broken">
        <a href="https://drive.google.com/drive/folders/broken">
          <div class="flip-entry-title">Shortcut Rusak</div>
        </a>
      </div>
      <div class="flip-entry" id="entry-ok">
        <a href="https://drive.google.com/drive/folders/ok">
          <div class="flip-entry-title">1. Budi Santoso</div>
        </a>
      </div>
    `;
    const okHtml = `
      <div class="flip-entry" id="entry-doc1">
        <a href="https://drive.google.com/file/d/doc1/view">
          <div class="flip-entry-title">APL01 Budi.docx</div>
        </a>
      </div>
    `;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("id=root-with-broken")) return new Response(rootHtml, { status: 200 });
      if (url.includes("id=broken")) return new Response("Not Found", { status: 404 });
      return new Response(okHtml, { status: 200 });
    });

    const files = await crawlPublicDriveFolder({ folderId: "root-with-broken" });
    expect(files).toHaveLength(1);
    expect(files[0]?.driveFileId).toBe("doc1");
  });

  it("classifies multi-part DIT forms as dit_form, supports multi-format DIT, and handles real-world filename typos (R8)", () => {
    expect(classifyDriveFileName("1. Form IBPR.docx", "Persyaratan/1. Bagas").docType).toBe("dit_form");
    expect(classifyDriveFileName("2. Form ERP.pdf", "Tugas DIT/Bagas").docType).toBe("dit_form");
    expect(classifyDriveFileName("3. Form Work Permit.docx", "").docType).toBe("dit_form");
    expect(classifyDriveFileName("4. Form Inspeksi P3K.pdf", "").docType).toBe("dit_form");
    expect(classifyDriveFileName("5. Form Investigasi Kecelakaan.docx", "").docType).toBe("dit_form");

    expect(
      classifyDriveFileName("Tugas_Presentasi_Budi.pdf", "Pelatihan AK3/Tugas DIT/Budi").docType,
    ).toBe("04b");
    expect(
      classifyDriveFileName("Kelompok Pekerjaan 1.docx", "Pelatihan AK3/Tugas DIT/Budi").docType,
    ).toBe("04b");
    expect(classifyDriveFileName("Naila pass poto.jpeg", "Persyaratan/Naila").docType).toBe("pas_foto");
    expect(classifyDriveFileName("SUKET S2.jpeg", "Persyaratan/Naila").docType).toBe("ijazah");
    expect(classifyDriveFileName("e-ktp.jpg", "Persyaratan/Budi").docType).toBe("ktp");
    expect(classifyDriveFileName("IMG_001.jpg", "Persyaratan/Budi/KTP").docType).toBe("ktp");
    expect(classifyDriveFileName("IMG_002.png", "Persyaratan/Budi/Pas Foto").docType).toBe("pas_foto");
    expect(classifyDriveFileName("scan.jpg", "Persyaratan/Budi/Ijazah").docType).toBe("ijazah");
    expect(
      classifyDriveFileName("SK Kenaikan Pangkat III.b Faradhila.pdf", "Persyaratan/Faradhila").docType,
    ).toBe("surat_tugas");
  });

  it("infers underscore DIT names, cleans folder prefixes/suffixes, and distinguishes authoritative roster (R8)", () => {
    expect(
      inferCandidateNameFromDrivePath(
        "Pelatihan AK3/Tugas DIT/DIT_Faradhila A.Manaf.ppt",
        "DIT_Faradhila A.Manaf.ppt",
      ),
    ).toBe("Faradhila A.Manaf");
    expect(
      inferCandidateNameFromDrivePath(
        "Pelatihan AK3/Tugas DIT/TUGAS SUANGI/Paparan.pptx",
        "Paparan.pptx",
      ),
    ).toBe("SUANGI");
    expect(
      inferCandidateNameFromDrivePath(
        "Pelatihan AK3/Tugas DIT/BAGAS K3/IBPR.pdf",
        "IBPR.pdf",
      ),
    ).toBe("BAGAS");
    expect(
      inferCandidateNameFromDrivePath(
        "Pelatihan AK3/AK3U LSP K3 Nasional.zip",
        "AK3U LSP K3 Nasional.zip",
      ),
    ).toBeNull();
    expect(
      inferCandidateFromDrivePath(
        "Persyaratan Pelatihan/1. Bagas Priambodo/KTP.jpg",
        "KTP.jpg",
      ).isAuthoritativeRoster,
    ).toBe(true);
    expect(
      inferCandidateFromDrivePath(
        "Tugas DIT/Bagas Priambodo/Presentasi.pptx",
        "Presentasi.pptx",
      ).isAuthoritativeRoster,
    ).toBe(false);
  });

  it("classifies unlabeled files from extracted document content and extracts roster names", () => {
    expect(
      classifyDocumentTextContent(
        "Formulir Identifikasi Bahaya dan Penilaian Risiko (IBPR) area boiler",
        "Lampiran_1.pdf",
      )?.docType,
    ).toBe("dit_form");

    expect(
      classifyDocumentTextContent(
        "FR.IA.06C LEMBAR JAWABAN TERTULIS ESAI peserta sertifikasi",
        "scan_doc.docx",
      )?.docType,
    ).toBe("06c");

    expect(
      extractCandidateNamesFromDocumentText(
        "apl01",
        "FR.APL.01 Nama lengkap: Faradhila Aushafiana Manaf\nNIK: 3174000000000001",
      ),
    ).toEqual(["Faradhila Aushafiana Manaf"]);

    expect(
      extractCandidateNamesFromDocumentText(
        "surat_tugas",
        "SURAT TUGAS\nDAFTAR PESERTA\n1. Bagas Priambodo\n2. Kiki Triyana\n",
      ),
    ).toEqual(["Bagas Priambodo", "Kiki Triyana"]);
  });

  it("classifies dot-prefixed F.ERP/F.Investigasi forms as dit_form, Cv. as cv, and MUK admin templates as template_muk (R10 Cacat 2)", () => {
    expect(
      classifyDriveFileName(
        "F.ERP_Lintang Trenggono.docx",
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT/Lintang Trenggono",
      ).docType,
    ).toBe("dit_form");
    expect(classifyDriveFileName("F.ERP.docx", "Tugas DIT/Andi").docType).toBe("dit_form");
    expect(
      classifyDriveFileName("F.IBPR-HIRADC AK3U_Lintang Trenggono.docx", "Tugas DIT/Lintang").docType,
    ).toBe("dit_form");
    expect(
      classifyDriveFileName("F.Investigasi_Insiden.docx", "Tugas DIT/Andi").docType,
    ).toBe("dit_form");
    expect(
      classifyDriveFileName("keperluan_administrasi.docx", "Persyaratan/1. Andi").docType,
    ).not.toBe("dit_form");

    expect(
      classifyDriveFileName("Cv. Suangi new.jpg", "Persyaratan Pelatihan AK3 umum BNSP/18. Suangi")
        .docType,
    ).toBe("cv");

    expect(
      classifyDriveFileName(
        "FR.MAPA.02. PETA INSTRUMEN ASESMEN (L).docx",
        "",
      ).docType,
    ).toBe("template_muk");
    expect(classifyDriveFileName("FR.AK.05. LAPORAN ASESMEN.docx", "").docType).toBe("template_muk");
    expect(classifyDriveFileName("DAFTAR PERIKSA MUK.docx", "").docType).toBe("template_muk");
    expect(classifyDriveFileName("SKKNI 2019-038.pdf.pdf", "").docType).toBe("template_muk");
    expect(classifyDriveFileName("Berita Acara Ujikom (AK3U).docx", "BA").docType).toBe(
      "template_muk",
    );
  });

  it("extracts TUGAS DIT WIWI -> Wiwi Widiawati (never WIWIK) and blocks raw folder names (R10 Cacat 3)", () => {
    const wiwiCandidate = inferCandidateNameFromDrivePath(
      "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT/TUGAS DIT WIWI/2. Form ERP WIWI.docx",
      "2. Form ERP WIWI.docx",
    );
    expect(wiwiCandidate).toBe("WIWI");

    const pool = [
      { id: "wiwik", displayName: "WIWIK SRIWAHYUNI BATUBARA" },
      { id: "wiwi", displayName: "Wiwi Widiawati, S.K.M" },
    ];
    expect(findBestMatchingCandidate(wiwiCandidate!, pool)?.id).toBe("wiwi");

    expect(
      inferCandidateNameFromDrivePath(
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT/Kelompok 2/DIT_Kelompok_2.pptx",
        "DIT_Kelompok_2.pptx",
      ),
    ).toBeNull();
    expect(
      inferCandidateNameFromDrivePath(
        "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT/TUGAS PRESENTASI DIT.pptx",
        "TUGAS PRESENTASI DIT.pptx",
      ),
    ).toBeNull();
    expect(hasTaskOrFolderPrefix("TUGAS SUANGI")).toBe(true);
    expect(hasTaskOrFolderPrefix("Suangi")).toBe(false);
    expect(hasTaskOrFolderPrefix("Dita Permata")).toBe(false);
  });

  it("classifies files using scheme-specific filePatterns from the batch scheme manifest (Round 14 D17/D21)", () => {
    const ictPmForms = [
      {
        formKey: "berita_acara",
        formName: "Kelengkapan Asesmen — Berita Acara & Daftar Hadir",
        filePatterns: ["berita acara", "daftar hadir", "kelengkapan asesmen"],
        instrumentRole: "administrasi",
        sortOrder: 1,
      },
      {
        formKey: "muk_portofolio",
        formName: "MUK Verifikasi Portofolio Proyek TIK",
        filePatterns: ["verifikasi portofolio", "project charter", "wbs", "bast"],
        instrumentRole: "portofolio",
        sortOrder: 2,
      },
      {
        formKey: "04a",
        formName: "MUK Kegiatan Terstruktur",
        filePatterns: ["04a", "kegiatan terstruktur"],
        instrumentRole: "dit",
        sortOrder: 3,
      },
      {
        formKey: "06c",
        formName: "Lembar Jawaban ICT PM",
        filePatterns: ["06c", "jawaban ict"],
        instrumentRole: "written_jawaban",
        sortOrder: 4,
      },
    ];

    const charterCls = classifyDriveFileName(
      "Project_Charter_Andi_Pratama.docx",
      "MUK Verifikasi Portofolio/1. Andi Pratama",
      ictPmForms,
    );
    expect(charterCls.docType).toBe("muk_portofolio");
    expect(charterCls.reason).toContain("muk_portofolio");

    const baCls = classifyDriveFileName(
      "Daftar_Hadir_Peserta_Uji.pdf",
      "Kelengkapan Asesmen",
      ictPmForms,
    );
    expect(baCls.docType).toBe("berita_acara");

    const ditCls = classifyDriveFileName(
      "Soal_Kegiatan_Terstruktur_ICT_PM.docx",
      "MUK Kegiatan Terstruktur",
      ictPmForms,
    );
    expect(ditCls.docType).toBe("04a");

    const ktpStillKtp = classifyDriveFileName(
      "KTP Andi Pratama.jpg",
      "Persyaratan/1. Andi Pratama",
      ictPmForms,
    );
    expect(ktpStillKtp.docType).toBe("ktp");

    const byContent = classifyDocumentTextContent(
      "Dokumen Verifikasi Portofolio Proyek TIK dan Project Charter Sistem ERP Nasional",
      "Lampiran_Asesi_01.pdf",
      "",
      ictPmForms,
    );
    expect(byContent?.docType).toBe("muk_portofolio");
  });

  describe("Status-suffix folder name inference (owner's folder pattern)", () => {
    it("infers person name from folder ending in 'Kurang Sertifikat Pelatihan'", () => {
      expect(
        inferCandidateNameFromDrivePath(
          "Budi Santoso - Kurang Sertifikat Pelatihan/KTP Budi.jpg",
          "KTP Budi.jpg",
        ),
      ).toBe("Budi Santoso");
      expect(
        inferCandidateNameFromDrivePath(
          "Siti Rahayu - Kurang Sertifikat Pelatihan/APL01 Siti.docx",
          "APL01 Siti.docx",
        ),
      ).toBe("Siti Rahayu");
    });

    it("infers person name from numbered folder with status suffix", () => {
      expect(
        inferCandidateNameFromDrivePath(
          "1. Budi Santoso - Kurang Sertifikat Pelatihan/KTP Budi.jpg",
          "KTP Budi.jpg",
        ),
      ).toBe("Budi Santoso");
    });

    it("does not reject folder merely because suffix contains structural word 'pelatihan'", () => {
      expect(
        inferCandidateNameFromDrivePath(
          "Faradhila A.Manaf - Kurang Berkas/Presentasi.pptx",
          "Presentasi.pptx",
        ),
      ).toBe("Faradhila A.Manaf");
    });

    it("still rejects fully structural folder names", () => {
      expect(
        inferCandidateNameFromDrivePath(
          "Materi Pelatihan/KTP Budi.jpg",
          "KTP Budi.jpg",
        ),
      ).toBeNull();
      expect(
        inferCandidateNameFromDrivePath(
          "Persyaratan Pelatihan/Dokumen.pdf",
          "Dokumen.pdf",
        ),
      ).toBeNull();
    });

    it("explains why no candidate is inferred for structural folders", () => {
      const reason = explainNameInference("Materi Pelatihan/KTP Budi.jpg");
      expect(reason).not.toBeNull();
      expect(reason).toContain("struktural");
    });

    it("returns null reason when candidate is found", () => {
      const reason = explainNameInference(
        "Budi Santoso - Kurang Sertifikat Pelatihan/KTP Budi.jpg",
      );
      expect(reason).toBeNull();
    });

    it("cleans status suffix in cleanCandidateLabel", () => {
      expect(cleanCandidateLabel("Budi Santoso - Kurang Sertifikat Pelatihan")).toBe(
        "Budi Santoso",
      );
      expect(cleanCandidateLabel("Siti Rahayu - Kurang Berkas")).toBe("Siti Rahayu");
      expect(cleanCandidateLabel("Materi Pelatihan")).toBe("Materi Pelatihan");
    });
  });

  describe("Presentation 04b and CV auto-classification fixes (Observasi R17 #1)", () => {
    const ak3uFormsWithLegacyDit = [
      {
        formKey: "04a",
        formName: "FR.IA.04A — Daftar Instruksi Terstruktur (DIT)",
        filePatterns: ["04a", "ia.04a", "ia 04a", "dit"],
        instrumentRole: "dit",
        sortOrder: 6,
      },
      {
        formKey: "04b",
        formName: "FR.IA.04B — Penilaian Proyek Singkat",
        filePatterns: ["04b", "ia.04b", "ia 04b", "presentasi"],
        instrumentRole: "presentation",
        sortOrder: 7,
      },
    ];

    it("classifies presentation slides as 04b even when AK3U 04a carries broad 'dit' pattern", () => {
      expect(
        classifyDriveFileName(
          "Presentasi DIT Budi Santoso.pptx",
          "Budi Santoso - Kurang Sertifikat Pelatihan",
          ak3uFormsWithLegacyDit,
        ).docType,
      ).toBe("04b");
      expect(
        classifyDriveFileName(
          "Paparan Proyek K3.pptx",
          "Persyaratan/1. Budi Santoso",
          ak3uFormsWithLegacyDit,
        ).docType,
      ).toBe("04b");
      expect(
        classifyDriveFileName(
          "Budi_Proyek_K3.pptx",
          "Budi Santoso",
          ak3uFormsWithLegacyDit,
        ).docType,
      ).toBe("04b");
      expect(
        classifyDriveFileName(
          "FR.IA.04A_Daftar_Instruksi_Terstruktur.docx",
          "MUK",
          ak3uFormsWithLegacyDit,
        ).docType,
      ).toBe("04a");
      expect(
        classifyDriveFileName(
          "Materi Pelatihan K3.pptx",
          "Materi",
          ak3uFormsWithLegacyDit,
        ).docType,
      ).toBe("materi_pelatihan");
    });

    it("classifies CV variants by filename and prevents CV text mentioning HIRADC/ERP from flipping to dit_form", () => {
      expect(classifyDriveFileName("DRH_Budi.pdf", "Budi Santoso").docType).toBe("cv");
      expect(classifyDriveFileName("Riwayat Hidup Budi.pdf", "Budi Santoso").docType).toBe("cv");
      expect(classifyDriveFileName("CVBudiSantoso.pdf", "Budi Santoso").docType).toBe("cv");
      expect(classifyDriveFileName("Resume_HSE_2026.pdf", "Budi Santoso").docType).toBe("cv");
      expect(classifyDriveFileName("Biodata_Peserta.docx", "Budi Santoso").docType).toBe("cv");

      const cvWithK3Content = classifyDocumentTextContent(
        "DAFTAR RIWAYAT HIDUP\nPengalaman Kerja: Menyusun HIRADC, ERP, dan inspeksi APD.",
        "Dokumen_Peserta_02.pdf",
      );
      expect(cvWithK3Content?.docType).toBe("cv");
    });
  });

  describe("Resilient Drive folder crawling with retries and partial isolation (P23-1)", () => {
    it("retries transient TimeoutError in embedded folder listing and succeeds on attempt 2", async () => {
      let attempts = 0;
      const html = `
        <div class="flip-entry" id="entry-f1">
          <a href="https://drive.google.com/file/d/f1/view">
            <div class="flip-entry-title">KTP Budi.jpg</div>
          </a>
        </div>
      `;

      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
        }
        return new Response(html, { status: 200 });
      });

      const files = await crawlPublicDriveFolder({
        folderId: "retry-root",
        retryBaseDelayMs: 1,
        maxAttempts: 3,
      });

      expect(attempts).toBe(2);
      expect(files).toHaveLength(1);
      expect(files[0]?.driveFileId).toBe("f1");
    });

    it("retries HTTP 503 in embedded listing and succeeds on attempt 2", async () => {
      let attempts = 0;
      const html = `
        <div class="flip-entry" id="entry-f2">
          <a href="https://drive.google.com/file/d/f2/view">
            <div class="flip-entry-title">CV Budi.pdf</div>
          </a>
        </div>
      `;

      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          return new Response("Service Unavailable", { status: 503 });
        }
        return new Response(html, { status: 200 });
      });

      const files = await crawlPublicDriveFolder({
        folderId: "retry-503",
        retryBaseDelayMs: 1,
        maxAttempts: 3,
      });

      expect(attempts).toBe(2);
      expect(files).toHaveLength(1);
      expect(files[0]?.docType).toBe("cv");
    });

    it("throws descriptive DRIVE_CRAWL_TIMEOUT when root listing times out across all retries", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      });

      await expect(
        crawlPublicDriveFolder({
          folderId: "always-timeout",
          retryBaseDelayMs: 1,
          maxAttempts: 2,
          timeoutMs: 5000,
        }),
      ).rejects.toThrow(/DRIVE_CRAWL_TIMEOUT.*embedded_listing:root.*2 percobaan/);
    });

    it("isolates a timed-out subfolder when sibling subfolder succeeds and emits warning", async () => {
      const rootHtml = `
        <div class="flip-entry" id="entry-slow">
          <a href="https://drive.google.com/drive/folders/slow">
            <div class="flip-entry-title">Subfolder Lambat</div>
          </a>
        </div>
        <div class="flip-entry" id="entry-fast">
          <a href="https://drive.google.com/drive/folders/fast">
            <div class="flip-entry-title">1. Budi Santoso</div>
          </a>
        </div>
      `;
      const fastHtml = `
        <div class="flip-entry" id="entry-doc-ok">
          <a href="https://drive.google.com/file/d/doc-ok/view">
            <div class="flip-entry-title">KTP Budi.jpg</div>
          </a>
        </div>
      `;

      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("id=root-partial")) return new Response(rootHtml, { status: 200 });
        if (url.includes("id=slow")) {
          throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
        }
        return new Response(fastHtml, { status: 200 });
      });

      const warnings: string[] = [];
      const files = await crawlPublicDriveFolder({
        folderId: "root-partial",
        retryBaseDelayMs: 1,
        maxAttempts: 2,
        onWarning: (w) => warnings.push(w),
      });

      expect(files).toHaveLength(1);
      expect(files[0]?.driveFileId).toBe("doc-ok");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("Subfolder Lambat");
    });

    it("retries transient 503 on Drive API before succeeding", async () => {
      let apiAttempts = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("googleapis.com/drive/v3/files")) {
          apiAttempts++;
          if (apiAttempts === 1) {
            return new Response("Backend Error", { status: 503 });
          }
          return new Response(
            JSON.stringify({
              files: [
                {
                  id: "api-f1",
                  name: "APL01_Budi.docx",
                  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        throw new Error("Should not fall back to embedded when retry succeeds");
      });

      const files = await crawlPublicDriveFolder({
        folderId: "api-retry-root",
        apiKey: "valid-key",
        retryBaseDelayMs: 1,
        maxAttempts: 3,
      });

      expect(apiAttempts).toBe(2);
      expect(files).toHaveLength(1);
      expect(files[0]?.docType).toBe("apl01");
    });
  });
});
