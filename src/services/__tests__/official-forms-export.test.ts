import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  generateAk02Docx,
  generateIa04bDocx,
  generateIa06cDocx,
} from "@/services/export";
import {
  AK3U_OFFICIAL_UNITS,
  buildAk02Payload,
  buildIa04bPayload,
  buildIa06cPayload,
  normalizeTukType,
} from "@/lib/forms/assessee-forms";

// Minimal 1x1 valid PNG bytes
const SAMPLE_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);

async function assertAllXmlWellFormed(zip: JSZip) {
  const xmlFiles = Object.keys(zip.files).filter(
    (name) => name.endsWith(".xml") || name.endsWith(".rels"),
  );
  expect(xmlFiles.length).toBeGreaterThan(3);
  for (const name of xmlFiles) {
    const content = await zip.file(name)!.async("string");
    expect(content).not.toContain("undefined");
    expect(content.trim().startsWith("<")).toBe(true);
  }
}

describe("Official AK3U DOCX Template Exports (AK.02, IA.04B, IA.06C)", () => {
  it("defaults TUK type to sewaktu whenever absent or unrecognised", () => {
    expect(normalizeTukType(null)).toBe("sewaktu");
    expect(normalizeTukType(undefined)).toBe("sewaktu");
    expect(normalizeTukType("")).toBe("sewaktu");
    expect(normalizeTukType("tempat_kerja")).toBe("tempat_kerja");
    expect(normalizeTukType("mandiri")).toBe("mandiri");
  });

  it("generates FR.AK.02 preserving all 4 tables, Sewaktu TUK, SDT recommendation, and signature", async () => {
    const payload = buildAk02Payload({
      schemeTitle: "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu",
      assessorName: "Daniel Stefanus",
      assessorRegNo: "MET. 000.003610 2023",
      assesseeName: "Budi Santoso",
      assessmentDate: "2026-11-18",
      decisions: AK3U_OFFICIAL_UNITS.map((title, idx) => ({
        unitCode: `M.71KKK01.${String(idx + 1).padStart(3, "0")}.1`,
        unitTitle: title,
        decision: "K",
      })),
      hasDit: true,
      hasWritten: true,
      signaturePngBytes: SAMPLE_PNG,
      signatureMimeType: "image/png",
    });

    const buf = await generateAk02Docx(payload);
    expect(buf.subarray(0, 2).toString("utf8")).toBe("PK");

    const zip = await JSZip.loadAsync(buf);
    await assertAllXmlWellFormed(zip);

    const docXml = await zip.file("word/document.xml")!.async("string");
    const relsXml = await zip.file("word/_rels/document.xml.rels")!.async("string");

    expect((docXml.match(/<w:tbl\b/g) ?? []).length).toBe(4);
    expect(docXml).toContain("Budi Santoso");
    expect(docXml).toContain("Daniel Stefanus");
    expect(docXml).toContain("MET. 000.003610 2023");
    expect(docXml).toContain("18 November 2026");
    expect(docXml).toContain("☑");
    expect(docXml).toContain('<w14:checked w14:val="1"/>');
    expect(docXml).toContain("rIdSig1");
    expect(relsXml).toContain('Id="rIdSig1"');
    expect(zip.file("word/media/signature.png")).toBeTruthy();
  });

  it("generates FR.IA.04B preserving 13 tables, KP lists, 13 SDT checkboxes, and signature", async () => {
    const payload = buildIa04bPayload({
      schemeTitle: "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu",
      assessorName: "Daniel Stefanus",
      assessorRegNo: "MET. 000.003610 2023",
      assesseeName: "Budi Santoso",
      assessmentDate: "2026-11-18",
      decisions: [
        {
          unitTitle: "Merancang Strategi Pengendalian Risiko K3 di Tempat Kerja",
          decision: "K",
        },
      ],
      ditAnalysis: {
        coverage_matrix: Array.from({ length: 13 }).map((_, i) => ({
          status: i === 12 ? "Belum Dibahas" : "Terpenuhi",
        })),
        readiness: { recommendation: "Kompeten" },
      },
      signaturePngBytes: SAMPLE_PNG,
      signatureMimeType: "image/png",
    });

    const buf = await generateIa04bDocx(payload);
    expect(buf.subarray(0, 2).toString("utf8")).toBe("PK");

    const zip = await JSZip.loadAsync(buf);
    await assertAllXmlWellFormed(zip);

    const docXml = await zip.file("word/document.xml")!.async("string");
    const plainText = docXml.replace(/<[^>]+>/g, "");
    expect((docXml.match(/<w:tbl\b/g) ?? []).length).toBe(13);
    expect(plainText).toContain("Kelompok Pekerjaan 1");
    expect(plainText).toContain("Kelompok Pekerjaan 4");
    expect(plainText).toContain("Budi Santoso");
    expect(docXml).toContain('<w14:checked w14:val="1"/>');
    expect(docXml).toContain('<w14:checked w14:val="0"/>');
    expect(docXml).toContain("rIdSig1");
  });

  it("generates FR.IA.06C preserving 5 tables, ListParagraph numbering, SDT checkboxes, and adding Content_Types", async () => {
    const payload = buildIa06cPayload({
      schemeTitle: "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu",
      assessorName: "Daniel Stefanus",
      assessorRegNo: "MET. 000.003610 2023",
      assesseeName: "Budi Santoso",
      assessmentDate: "2026-11-18",
      writtenGrading: {
        item_verdicts: [
          { questionNo: 1, verdict: "Benar", studentSpan: "HIRADC dilakukan sebelum pekerjaan dimulai." },
          { questionNo: 2, verdict: "Salah", studentSpan: "Jawaban tidak lengkap." },
        ],
        vatm_unit_recommendations: [
          { unitCode: "M.71KKK01.001.1", unitTitle: "Risk Control", recommendation: "K" },
        ],
      },
      signaturePngBytes: SAMPLE_PNG,
      signatureMimeType: "image/png",
    });

    const buf = await generateIa06cDocx(payload);
    expect(buf.subarray(0, 2).toString("utf8")).toBe("PK");

    const zip = await JSZip.loadAsync(buf);
    await assertAllXmlWellFormed(zip);

    const docXml = await zip.file("word/document.xml")!.async("string");
    const ctXml = await zip.file("[Content_Types].xml")!.async("string");

    expect((docXml.match(/<w:tbl\b/g) ?? []).length).toBe(5);
    expect(docXml).toContain("HIRADC dilakukan sebelum pekerjaan dimulai.");
    expect(docXml).toContain("ListParagraph");
    expect(docXml).toContain('<w14:checked w14:val="1"/>');
    expect(docXml).toContain("rIdSig1");
    expect(ctXml).toContain('Extension="png"');
    expect(zip.file("word/media/signature.png")).toBeTruthy();
  });
});
