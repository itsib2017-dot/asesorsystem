import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildIa04aPayload } from "../assessee-forms";
import { generateIa04aDocx } from "@/services/export";

describe("buildIa04aPayload extracted 04A fallback (P1-11)", () => {
  it("falls back to extracted04aText when rawOutput.frIa04aText is absent and renders into DOCX", async () => {
    const payload = buildIa04aPayload({
      schemeTitle: "Ahli K3 Umum",
      schemeNumber: "SKM/2037/00013/2/2021/1",
      tukType: "sewaktu",
      assessorName: "Daniel Stefanus",
      assessorRegNo: "MET. 000.003610 2023",
      assesseeName: "Asesi Uji",
      assessmentDate: "2026-11-26",
      ditAnalysis: {
        readiness: { recommendation: "BK" },
        questionBank: [],
        rawOutput: {},
      },
      extracted04aText: "Instruksi Tugas Terstruktur Resmi FR.IA.04A: Susun analisis HIRADC lengkap.",
    });

    expect(payload.ditExtractedText).toContain("Susun analisis HIRADC lengkap");

    const docxBuf = await generateIa04aDocx(payload);
    const zip = await JSZip.loadAsync(docxBuf);
    const xml = await zip.file("word/document.xml")!.async("string");
    const plain = xml.replace(/<[^>]+>/g, "");
    expect(plain).toContain("Susun analisis HIRADC lengkap");
    expect(plain).not.toContain("Tidak ada teks instruksi yang tersedia");
  });
});
