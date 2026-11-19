import { describe, expect, it, vi, afterEach } from "vitest";
import {
  classifyDriveFileName,
  crawlPublicDriveFolder,
  inferCandidateNameFromDrivePath,
} from "../drive";

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
});
