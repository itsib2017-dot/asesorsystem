import { describe, it, expect } from "vitest";
import {
  computeNameSimilarity,
  isInitialAbbreviationMatch,
  normalisePersonName,
} from "../names";
import { runNameJury } from "@/services/name-jury";

describe("KTP-Authoritative Name Comparison & Jury (D6 & D10)", () => {
  it("normalises titles and punctuation without mutating original strings", () => {
    expect(normalisePersonName("drg. Budi Santoso, S.K.M.")).toBe("budi santoso");
  });

  it("recognises initial abbreviations against authoritative KTP spelling", () => {
    expect(isInitialAbbreviationMatch("Declan Rice Pangabean", "Declan Rice P.")).toBe(
      true,
    );
    expect(computeNameSimilarity("Declan Rice Pangabean", "Declan Rice Pangabean")).toBe(
      1,
    );
  });

  it("returns needs_human with NULL proposal when OCR confidence is below floor", async () => {
    const out = await runNameJury({
      nameKtpOcr: "Budi Santoso",
      nameApl01: "Budi Santoso",
      nameSuratTugas: "Budi Santoso",
      nameIjazah: "Budi Santoso",
      ocrConfidence: 0.45,
      ocrConfidenceFloor: 0.75,
    });

    expect(out.result.verdict).toBe("needs_human");
    expect(out.result.proposed_certificate_name).toBeNull();
  });

  it("proposes exact KTP spelling on mismatch_resolved (Declan Rice case)", async () => {
    const out = await runNameJury({
      nameKtpOcr: "Declan Rice Pangabean",
      nameApl01: "Declan Rice Pangabean",
      nameSuratTugas: "Declan Rice P.",
      nameIjazah: "Declan Rice Pangabean",
      ocrConfidence: 0.95,
      ocrConfidenceFloor: 0.75,
    });

    expect(out.result.verdict).toBe("mismatch_resolved");
    expect(out.result.proposed_certificate_name).toBe("Declan Rice Pangabean");
  });
});
