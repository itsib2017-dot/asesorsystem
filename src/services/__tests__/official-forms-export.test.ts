import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  generateAk02Docx,
  generateIa04bDocx,
  generateIa06cDocx,
  normalizeBlankoXmlForExport,
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

  it("keeps AK.02, IA.04B, and IA.06C completely neutral (no checked K/BK or strikethrough) when unassessed", async () => {
    const ak02 = buildAk02Payload({
      schemeTitle: "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu",
      assessorName: "Daniel Stefanus",
      assessorRegNo: "MET. 000.003610 2023",
      assesseeName: "Calon Belum Dinilai",
      assessmentDate: "2026-11-18",
      decisions: [{ unitCode: "M.71KKK01.001.1", unitTitle: AK3U_OFFICIAL_UNITS[0], decision: null }],
      hasDit: false,
      hasWritten: false,
      hasInterview: false,
      signaturePngBytes: SAMPLE_PNG,
      signatureMimeType: "image/png",
    });
    expect(ak02.overallRecommendation).toBeNull();
    expect(ak02.unitDecisions.every((u) => u.evidenceTypes.length === 0)).toBe(true);

    const ak02Zip = await JSZip.loadAsync(await generateAk02Docx(ak02));
    const ak02Xml = await ak02Zip.file("word/document.xml")!.async("string");
    expect(ak02Xml).not.toContain("Asesmen dilaksanakan sesuai prosedur");
    // In Table 2 row 14, both K and BK checkboxes stay unchecked (w14:val="0")
    expect(ak02Xml).not.toMatch(/Rekomendasi hasil asesmen[\s\S]*?<w14:checked w14:val="1"\/>/);

    const ia04b = buildIa04bPayload({
      schemeTitle: "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu",
      assessorName: "Daniel Stefanus",
      assessorRegNo: "MET. 000.003610 2023",
      assesseeName: "Calon Belum Dinilai",
      assessmentDate: "2026-11-18",
      ditAnalysis: null,
      decisions: [],
      signaturePngBytes: SAMPLE_PNG,
      signatureMimeType: "image/png",
    });
    expect(ia04b.overallRecommendation).toBeNull();
    expect(ia04b.itemAchievedFlags.every((v) => v === null)).toBe(true);

    const ia04bZip = await JSZip.loadAsync(await generateIa04bDocx(ia04b));
    const ia04bXml = await ia04bZip.file("word/document.xml")!.async("string");
    const ia04bRecSlice = ia04bXml.slice(ia04bXml.indexOf("Rekomendasi Asesor"));
    expect(ia04bRecSlice).not.toContain("<w:strike");
    expect(ia04bRecSlice).not.toContain("☑");

    const ia06c = buildIa06cPayload({
      schemeTitle: "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu",
      assessorName: "Daniel Stefanus",
      assessorRegNo: "MET. 000.003610 2023",
      assesseeName: "Calon Belum Dinilai",
      assessmentDate: "2026-11-18",
      writtenGrading: null,
      signaturePngBytes: SAMPLE_PNG,
      signatureMimeType: "image/png",
    });
    expect(ia06c.overallAchieved).toBeNull();

    const ia06cZip = await JSZip.loadAsync(await generateIa06cDocx(ia06c));
    const ia06cXml = await ia06cZip.file("word/document.xml")!.async("string");
    const ia06cFeedbackIdx = ia06cXml.indexOf("Aspek pengetahuan seluruh unit");
    const ia06cFeedbackSlice = ia06cXml.slice(ia06cFeedbackIdx, ia06cFeedbackIdx + 1800);
    expect(ia06cFeedbackSlice).not.toContain("<w:strike");
  });

  it("auto-resolves AK.02 to BK on even 1 BK unit, and respects manual assessor override as final call", async () => {
    const partialWithOneBk = [
      { unitCode: "M.71KKK01.001.1", unitTitle: AK3U_OFFICIAL_UNITS[0], decision: "K" },
      { unitCode: "M.71KKK01.002.1", unitTitle: AK3U_OFFICIAL_UNITS[1], decision: "BK", assessorNote: "Bukti tanggap darurat belum lengkap" },
    ];

    const autoBk = buildAk02Payload({
      schemeTitle: "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu",
      assessorName: "Daniel Stefanus",
      assessorRegNo: "MET. 000.003610 2023",
      assesseeName: "Dewi Lestari",
      assessmentDate: "2026-11-18",
      decisions: partialWithOneBk,
      hasDit: true,
      hasWritten: false,
      signaturePngBytes: SAMPLE_PNG,
      signatureMimeType: "image/png",
    });
    expect(autoBk.overallRecommendation).toBe("BK");
    expect(autoBk.followUpNote).toContain("M.71KKK01.002.1");

    const manualK = buildAk02Payload({
      schemeTitle: "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu",
      assessorName: "Daniel Stefanus",
      assessorRegNo: "MET. 000.003610 2023",
      assesseeName: "Dewi Lestari",
      assessmentDate: "2026-11-18",
      decisions: partialWithOneBk,
      manualOverride: {
        overrideDecision: "K",
        overrideReason: "Asesi melampirkan bukti revisi sah saat wawancara klarifikasi",
      },
      hasDit: true,
      hasWritten: false,
      signaturePngBytes: SAMPLE_PNG,
      signatureMimeType: "image/png",
    });
    expect(manualK.overallRecommendation).toBe("K");
    expect(manualK.decisionSource).toBe("manual_override");
    expect(manualK.assessorComment).toContain("secara manual oleh asesor (Kompeten)");

    const overrideZip = await JSZip.loadAsync(await generateAk02Docx(manualK));
    const overrideXml = await overrideZip.file("word/document.xml")!.async("string");
    expect(overrideXml).toContain("Asesi melampirkan bukti revisi sah");
  });

  it("normalises negative DOCX page margins and header textbox wrap attributes, and ticks AK.02 proyek for dit_form", () => {
    const cleaned = normalizeBlankoXmlForExport({
      docXml: '<w:pgMar w:top="-720" w:right="1440" w:bottom="-360" w:left="1440"/>',
      headerXml: '<wps:txbx><wps:bodyPr wrap="square" lIns="0"/></wps:txbx>',
    });
    expect(cleaned.docXml).toContain('w:top="720"');
    expect(cleaned.docXml).toContain('w:bottom="360"');
    expect(cleaned.headerXml).toContain('wrap="none"');

    const ak02FromDitForms = buildAk02Payload({
      schemeTitle: "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      assessorName: "Daniel Stefanus",
      assessorRegNo: "MET. 000.003610 2023",
      assesseeName: "Bagas Priambodo",
      assessmentDate: "2026-11-18",
      decisions: [],
      hasDit: false,
      hasDitForms: true,
      hasWritten: false,
    });
    expect(ak02FromDitForms.unitDecisions[0]?.evidenceTypes).toContain("proyek");
  });
});
