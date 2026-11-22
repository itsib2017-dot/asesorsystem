import { describe, expect, it } from "vitest";
import { normalizeOcrConfidence } from "../confidence";
import { DEFAULT_NAME_JURY_THRESHOLDS, runNameJury } from "@/services/name-jury";

describe("normalizeOcrConfidence", () => {
  it("normalizes 0-100 Tesseract percentages into [0, 1] scale", () => {
    expect(normalizeOcrConfidence(33)).toBe(0.33);
    expect(normalizeOcrConfidence(85.5)).toBe(0.855);
    expect(normalizeOcrConfidence(100)).toBe(1);
    expect(normalizeOcrConfidence(150)).toBe(1);
  });

  it("preserves already normalized [0, 1] values with 4-decimal precision", () => {
    expect(normalizeOcrConfidence(0.75)).toBe(0.75);
    expect(normalizeOcrConfidence(0.91234)).toBe(0.9123);
    expect(normalizeOcrConfidence(1)).toBe(1);
    expect(normalizeOcrConfidence(0)).toBe(0);
  });

  it("clamps negative, NaN, null, and undefined inputs safely to 0", () => {
    expect(normalizeOcrConfidence(-5)).toBe(0);
    expect(normalizeOcrConfidence(Number.NaN)).toBe(0);
    expect(normalizeOcrConfidence(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeOcrConfidence(null)).toBe(0);
    expect(normalizeOcrConfidence(undefined)).toBe(0);
  });

  it("enforces Rule 30 0.75 confidence floor when Tesseract returns raw 33", async () => {
    const normalized = normalizeOcrConfidence(33);
    const out = await runNameJury({
      nameKtpOcr: "Budi Santoso",
      nameApl01: "Budi Santoso",
      nameSuratTugas: "Budi Santoso",
      nameIjazah: "Budi Santoso",
      ocrConfidence: normalized,
      ocrConfidenceFloor: 0.75,
      thresholds: DEFAULT_NAME_JURY_THRESHOLDS,
    });

    expect(out.result.ocr_confidence).toBe(0.33);
    expect(out.result.verdict).toBe("needs_human");
    expect(out.result.proposed_certificate_name).toBeNull();
  });
});
