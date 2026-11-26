import { describe, expect, it } from "vitest";
import { buildAssesseeExportReadiness } from "../assessee-readiness";

describe("buildAssesseeExportReadiness", () => {
  it("reports full readiness when mandatory and optional items are complete", () => {
    const res = buildAssesseeExportReadiness({
      hasActiveSignature: true,
      isNameConfirmed: true,
      decidedUnitCount: 13,
      totalSchemeUnits: 13,
      hasSaved04b: true,
      hasSaved06c: true,
      hasInterview: true,
    });
    expect(res.isReady).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.summaryLine).toContain("Siap ekspor");
  });

  it("lists exact blocking prerequisites before export", () => {
    const res = buildAssesseeExportReadiness({
      hasActiveSignature: false,
      isNameConfirmed: false,
      decidedUnitCount: 10,
      totalSchemeUnits: 13,
      hasSaved04b: false,
      hasSaved06c: true,
      hasInterview: false,
    });
    expect(res.isReady).toBe(false);
    expect(res.missing).toEqual([
      "Tanda tangan asesor belum diunggah",
      "Konfirmasi nama KTP belum selesai",
      "3/13 unit FR.AK.02 belum diputus",
    ]);
    expect(res.optionalPending).toEqual([
      "FR.IA.04B belum disimpan",
      "FR.IA.09 belum dinilai",
    ]);
    expect(res.summaryLine).toContain("Belum lengkap sebelum ekspor:");
  });
});
