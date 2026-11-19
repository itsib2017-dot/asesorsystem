import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  generateAk02Docx,
  generateAk05Docx,
  generateIa04bDocx,
  generateIa06cDocx,
  normalizeBlankoXmlForExport,
  resolveSchemeTemplateBuffer,
} from "@/services/export";
import type { SchemeRecord } from "@/repositories/schemes.repository";
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

  it("exports AK.02, IA.04B, IA.06C, and AK.05 for non-AK3U scheme (ICT-PM) using scheme blanko registry and manifest questions with zero AK3U leakage (Round 14)", async () => {
    const customZip = new JSZip();
    customZip.file(
      "word/document.xml",
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>{{SCHEME_TITLE}} | {{SCHEME_NUMBER}} | {{ASSESSEE_NAME}} | {{ASSESSOR_NAME}} | {{RECOMMENDATION}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`,
    );
    const customTemplateBuf = await customZip.generateAsync({ type: "nodebuffer" });

    const ictScheme: SchemeRecord = {
      id: "scheme-ict-1",
      lspId: "lsp-1",
      code: "ICT-PM",
      name: "Okupasi ICT Project Manager (SKM/1522/00008/2/2024/3)",
      version: 1,
      forms: [
        {
          id: "f-ak02",
          formKey: "ak02",
          formName: "FR.AK.02 — ICT PM",
          filePatterns: ["ak02"],
          required: true,
          instrumentRole: "keputusan",
          sortOrder: 1,
          templateStoragePath: "lsp-1/scheme-ict-1/ak02/v1-AK02-ICT.docx",
          templateFileName: "AK02-ICT.docx",
          templateMimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          templateSha256: "sha-ict",
          templateVersion: 1,
          templateUploadedAt: "2026-11-19T12:00:00Z",
          templateUploadedBy: "user-1",
        },
      ],
      manifest: {
        questionCounts: { official04bCount: 2, written06aCount: 2, questionBankCount: 2 },
        decisionRule: "VATM",
        decisionRuleRef: "SKKNI Manajemen Proyek TIK",
        prerequisites: [],
        registrationRequirements: [],
        units: [
          { code: "J.620900.001.02", title: "Menyusun Perencanaan Proyek TIK (Project Charter & WBS)" },
          { code: "J.620900.002.02", title: "Mengelola Jadwal, Biaya, dan Sumber Daya Proyek TIK" },
        ],
        kelompokPekerjaan: [
          {
            kpIndex: 1,
            title: "Kelompok Pekerjaan 1 — Inisiasi & Perencanaan Proyek TIK",
            units: [
              { no: 1, code: "J.620900.001.02", title: "Menyusun Perencanaan Proyek TIK (Project Charter & WBS)" },
              { no: 2, code: "J.620900.002.02", title: "Mengelola Jadwal, Biaya, dan Sumber Daya Proyek TIK" },
            ],
            aspects: [
              {
                kpIndex: 1,
                no: 1,
                unitCode: "J.620900.001.02",
                unitTitle: "Menyusun Perencanaan Proyek TIK (Project Charter & WBS)",
                lingkup: "Penyusunan Project Charter & WBS",
                question: "Bagaimana menurunkan tujuan bisnis ke dalam Project Charter?",
                kukRef: "1.1 Project Charter disusun.",
              },
              {
                kpIndex: 1,
                no: 2,
                unitCode: "J.620900.002.02",
                unitTitle: "Mengelola Jadwal, Biaya, dan Sumber Daya Proyek TIK",
                lingkup: "Estimasi Critical Path & EVM",
                question: "Bagaimana menghitung SPI dan CPI pada proyek TIK?",
                kukRef: "2.2 Jadwal dan anggaran disepakati.",
              },
            ],
          },
        ],
        formSuffixMapping: { soal: "06A", kunci: "06B", jawaban: "06C" },
      },
    };

    const resolvedBuf = await resolveSchemeTemplateBuffer({
      scheme: ictScheme,
      formKeys: ["ak02"],
      defaultAk3uFileName: "FR.AK.02.REKAMAN_ASESMEN.docx",
      downloadFromStorage: async (sp) =>
        sp === "lsp-1/scheme-ict-1/ak02/v1-AK02-ICT.docx" ? customTemplateBuf : undefined,
    });
    expect(resolvedBuf).toBe(customTemplateBuf);

    // 1. Custom uploaded template with placeholder tokens
    const ak02Payload = buildAk02Payload({
      scheme: ictScheme,
      schemeTitle: "OKUPASI ICT PROJECT MANAGER",
      schemeNumber: "SKM/1522/00008/2/2024/3",
      assessorName: "Dr. Rina TIK",
      assessorRegNo: "MET.000.9999",
      assesseeName: "Andi Pratama",
      assessmentDate: "2026-11-19",
      decisions: [
        { unitCode: "J.620900.001.02", unitTitle: "Menyusun Perencanaan Proyek TIK (Project Charter & WBS)", decision: "K" },
        { unitCode: "J.620900.002.02", unitTitle: "Mengelola Jadwal, Biaya, dan Sumber Daya Proyek TIK", decision: "K" },
      ],
      hasDit: true,
      hasWritten: true,
    });
    const customAk02Docx = await generateAk02Docx({
      ...ak02Payload,
      templateBuffer: resolvedBuf,
    });
    const customAk02Xml = await (await JSZip.loadAsync(customAk02Docx))
      .file("word/document.xml")!
      .async("string");
    expect(customAk02Xml).toContain("ICT PROJECT MANAGER");
    expect(customAk02Xml).toContain("Andi Pratama");
    expect(customAk02Xml).toContain("Dr. Rina TIK");

    // 2. Standard 4-table AK.02 template dynamically adapted to ICT-PM's 2 units (zero AK3U units)
    const dynamicAk02Docx = await generateAk02Docx(ak02Payload);
    const dynamicAk02Xml = await (await JSZip.loadAsync(dynamicAk02Docx))
      .file("word/document.xml")!
      .async("string");
    expect(dynamicAk02Xml).toContain("J.620900.001.02");
    expect(dynamicAk02Xml).toContain("Project Charter");
    expect(dynamicAk02Xml).not.toContain("Merancang Strategi Pengendalian Risiko K3");

    // 3. Standard IA.04B template dynamically adapted to ICT-PM's Kelompok Pekerjaan & questions (zero AK3U K3 questions)
    const ia04bPayload = buildIa04bPayload({
      scheme: ictScheme,
      schemeTitle: "OKUPASI ICT PROJECT MANAGER",
      schemeNumber: "SKM/1522/00008/2/2024/3",
      assessorName: "Dr. Rina TIK",
      assessorRegNo: "MET.000.9999",
      assesseeName: "Andi Pratama",
      assessmentDate: "2026-11-19",
      decisions: [
        { unitTitle: "Menyusun Perencanaan Proyek TIK (Project Charter & WBS)", decision: "K" },
        { unitTitle: "Mengelola Jadwal, Biaya, dan Sumber Daya Proyek TIK", decision: "K" },
      ],
    });
    const dynamic04bDocx = await generateIa04bDocx(ia04bPayload);
    const dynamic04bXml = await (await JSZip.loadAsync(dynamic04bDocx))
      .file("word/document.xml")!
      .async("string");
    const plain04b = dynamic04bXml.replace(/<[^>]+>/g, "");
    expect(plain04b).toContain("Inisiasi &amp; Perencanaan Proyek TIK");
    expect(plain04b).toContain("Bagaimana menurunkan tujuan bisnis ke dalam Project Charter?");
    expect(plain04b).toContain("Bagaimana menghitung SPI dan CPI pada proyek TIK?");
    expect(plain04b).not.toContain("APAR");
    expect(plain04b).not.toContain("Kelompok Pekerjaan 4");

    // 4. IA.06C sized to ICT-PM's 2 written questions (instead of hardcoded 13)
    const ia06cPayload = buildIa06cPayload({
      scheme: ictScheme,
      schemeTitle: "OKUPASI ICT PROJECT MANAGER",
      schemeNumber: "SKM/1522/00008/2/2024/3",
      assessorName: "Dr. Rina TIK",
      assessorRegNo: "MET.000.9999",
      assesseeName: "Andi Pratama",
      assessmentDate: "2026-11-19",
      writtenGrading: null,
    });
    expect(ia06cPayload.answers).toHaveLength(2);
    const dynamic06cDocx = await generateIa06cDocx(ia06cPayload);
    const dynamic06cXml = await (await JSZip.loadAsync(dynamic06cDocx))
      .file("word/document.xml")!
      .async("string");
    expect(dynamic06cXml).toContain("ICT PROJECT MANAGER");

    // 5. AK.05 with custom templateBuffer
    const customAk05Docx = await generateAk05Docx({
      schemeCode: "ICT-PM",
      schemeTitle: "OKUPASI ICT PROJECT MANAGER",
      schemeNumber: "SKM/1522/00008/2/2024/3",
      tukType: "sewaktu",
      assessorName: "Dr. Rina TIK",
      assessorRegNo: "MET.000.9999",
      assessmentDate: "2026-11-19",
      rows: [{ no: 1, assesseeName: "Andi Pratama", recommendation: "K", keterangan: "-" }],
      notesPositiveNegative: "Baik",
      notesRejection: "-",
      notesImprovement: "-",
      templateBuffer: customTemplateBuf,
    });
    const customAk05Xml = await (await JSZip.loadAsync(customAk05Docx))
      .file("word/document.xml")!
      .async("string");
    expect(customAk05Xml).toContain("ICT PROJECT MANAGER");
  });
});
