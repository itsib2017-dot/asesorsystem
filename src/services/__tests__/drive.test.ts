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
});
