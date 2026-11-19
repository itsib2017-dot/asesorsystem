import { describe, expect, it } from "vitest";
import type { SchemeRecord } from "@/repositories/schemes.repository";
import {
  buildAk02Payload,
  buildIa04bPayload,
  buildIa06cPayload,
  hasGenericFallbackKelompok,
  isAk3uScheme,
  resolveSchemeBranding,
  resolveSchemeDocColumns,
  resolveSchemeInterviewQuestions,
  resolveSchemeKelompokPekerjaan,
  resolveSchemeUnitsList,
  resolveSchemeWrittenQuestions,
} from "../assessee-forms";
import { formatSchemeInstructionsText } from "../dit-inputs";
import { resolveUnitsForScheme } from "../sync-vatm-decisions";

describe("D21 / R7 Scheme Manifest Portability", () => {
  const customScheme: SchemeRecord = {
    id: "scheme-pemrog-1",
    lspId: "lsp-1",
    code: "PRG-01",
    name: "Okupasi Pemrogram Junior (SKM/999/001/2026/1)",
    version: 1,
    forms: [],
    manifest: {
      questionCounts: {
        official04bCount: 2,
        written06aCount: 5,
        questionBankCount: 5,
      },
      decisionRule: "VATM",
      decisionRuleRef: "SKKNI TIK 2024",
      prerequisites: ["Lulusan SMK/D3"],
      registrationRequirements: ["KTP", "CV"],
      units: [
        { code: "J.620100.001.02", title: "Menggunakan Struktur Data" },
        { code: "J.620100.002.02", title: "Menerapkan Pemrograman Terstruktur" },
      ],
      docColumns: ["APL.01", "KTP", "Portfolio Git", "04A", "06C"],
      branding: {
        leftLogoUrl: "/logos/custom-bnsp.png",
        leftLogoAlt: "Custom BNSP",
        rightLogoUrl: "/logos/custom-lsp.png",
        rightLogoAlt: "LSP TIK Nusantara",
      },
      formSuffixMapping: {
        soal: "06A",
        kunci: "06B",
        jawaban: "06C",
      },
    },
  };

  it("uses manifest.units instead of hardcoded AK3U units in buildAk02Payload", () => {
    const payload = buildAk02Payload({
      scheme: customScheme,
      schemeTitle: "Pemrogram Junior",
      schemeNumber: "SKM/999/001/2026/1",
      assessorName: "Asesor TIK",
      assessorRegNo: "MET.999",
      assesseeName: "Peserta Uji",
      assessmentDate: "2026-11-18",
      decisions: [
        { unitCode: "J.620100.001.02", unitTitle: "Menggunakan Struktur Data", decision: "K" },
      ],
      hasDit: true,
      hasWritten: false,
    });

    expect(payload.unitDecisions).toHaveLength(2);
    expect(payload.unitDecisions[0]?.unitCode).toBe("J.620100.001.02");
    expect(payload.unitDecisions[0]?.unitTitle).toBe("Menggunakan Struktur Data");
    expect(payload.unitDecisions[1]?.unitTitle).toBe("Menerapkan Pemrograman Terstruktur");
  });

  it("synthesizes non-AK3U Kelompok Pekerjaan from manifest.units and resolves docColumns & branding", () => {
    const kps = resolveSchemeKelompokPekerjaan(customScheme);
    expect(kps).toHaveLength(1);
    expect(kps[0]?.units).toHaveLength(2);
    expect(kps[0]?.aspects).toHaveLength(2);

    const ia04b = buildIa04bPayload({
      scheme: customScheme,
      schemeTitle: "Pemrogram Junior",
      schemeNumber: "SKM/999/001/2026/1",
      assessorName: "Asesor TIK",
      assessorRegNo: "MET.999",
      assesseeName: "Peserta Uji",
      assessmentDate: "2026-11-18",
      decisions: [],
    });
    expect(ia04b.itemAchievedFlags).toHaveLength(2);

    expect(resolveSchemeDocColumns(customScheme)).toEqual([
      "APL.01",
      "KTP",
      "Portfolio Git",
      "04A",
      "06C",
    ]);

    expect(resolveSchemeBranding(customScheme)).toEqual({
      leftLogoUrl: "/logos/custom-bnsp.png",
      leftLogoAlt: "Custom BNSP",
      rightLogoUrl: "/logos/custom-lsp.png",
      rightLogoAlt: "LSP TIK Nusantara",
    });
    expect(hasGenericFallbackKelompok(customScheme)).toBe(true);
    expect(formatSchemeInstructionsText(customScheme)).toContain("fallback generik");
  });

  it("aligns resolveUnitsForScheme with resolveSchemeUnitsList when units are defined only under kelompokPekerjaan (M1)", () => {
    const kpOnlyScheme: SchemeRecord = {
      ...customScheme,
      manifest: {
        ...customScheme.manifest,
        units: [],
        kelompokPekerjaan: [
          {
            kpIndex: 1,
            title: "KP Khusus",
            units: [
              { no: 1, code: "KP.001", title: "Menyusun Analisis K3" },
              { no: 2, code: "KP.002", title: "Melakukan Audit Internal" },
            ],
            aspects: [],
          },
        ],
      },
    };

    expect(hasGenericFallbackKelompok(kpOnlyScheme)).toBe(false);
    expect(resolveUnitsForScheme(kpOnlyScheme)).toEqual(
      resolveSchemeUnitsList(kpOnlyScheme),
    );
    expect(resolveUnitsForScheme(kpOnlyScheme)).toEqual([
      { code: "KP.001", title: "Menyusun Analisis K3" },
      { code: "KP.002", title: "Melakukan Audit Internal" },
    ]);
  });

  it("never leaks AK3U units, AK3U 04B questions, or /templates/ak3u/ logos onto non-AK3U schemes (Round 14)", () => {
    const emptyCustomScheme: SchemeRecord = {
      id: "scheme-ict-pm",
      lspId: "lsp-1",
      code: "ICT-PM",
      name: "Okupasi ICT Project Manager (SKM/1522/00008/2/2024/3)",
      version: 1,
      forms: [],
      manifest: {
        questionCounts: {
          official04bCount: 4,
          written06aCount: 5,
          questionBankCount: 5,
        },
        decisionRule: "VATM",
        decisionRuleRef: "SKKNI Manajemen Proyek TIK",
        prerequisites: [],
        registrationRequirements: [],
        units: [],
        writtenQuestions: [
          { no: 1, unitCode: "J.620900.001.02", question: "Jelaskan komponen Project Charter." },
        ],
        interviewQuestions: [
          { no: 1, unitCode: "J.620900.001.02", question: "Ceritakan proyek TIK terakhir Anda?" },
        ],
        formSuffixMapping: { soal: "06A", kunci: "06B", jawaban: "06C" },
      },
    };

    expect(isAk3uScheme(emptyCustomScheme)).toBe(false);
    expect(resolveSchemeUnitsList(emptyCustomScheme)).toEqual([]);
    expect(resolveSchemeKelompokPekerjaan(emptyCustomScheme)).toEqual([]);
    expect(resolveSchemeWrittenQuestions(emptyCustomScheme)).toHaveLength(1);
    expect(resolveSchemeInterviewQuestions(emptyCustomScheme)).toHaveLength(1);

    const branding = resolveSchemeBranding(emptyCustomScheme);
    expect(branding.leftLogoUrl).toBeUndefined();
    expect(branding.rightLogoUrl).toBeUndefined();
    expect(branding.rightLogoAlt).toContain("ICT-PM");

    const ia06c = buildIa06cPayload({
      scheme: emptyCustomScheme,
      schemeTitle: "Okupasi ICT Project Manager",
      schemeNumber: "SKM/1522/00008/2/2024/3",
      assessorName: "Asesor TIK",
      assessorRegNo: "MET.999",
      assesseeName: "Peserta ICT",
      assessmentDate: "2026-11-19",
      writtenGrading: null,
    });
    expect(ia06c.answers).toHaveLength(5);
  });
});
