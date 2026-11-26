import { describe, expect, it } from "vitest";
import { sanitizeExtractedText } from "../sanitize-extracted-text";

describe("sanitizeExtractedText", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeExtractedText("")).toBe("");
  });

  it("strips NUL, disallowed C0/DEL controls, and Unicode non-characters while keeping tab/LF/CR", () => {
    const dirty = "Nama:\tBudi\u0000\x01\x07\x0b\x1f\r\nAlamat:\x7f Jakarta\uFFFE\uFFFF";
    expect(sanitizeExtractedText(dirty)).toBe("Nama:\tBudi\r\nAlamat: Jakarta");
  });

  it("strips unpaired high and low UTF-16 surrogates without corrupting surrounding text", () => {
    const highOnly = "Pengalaman \uD800 K3";
    const lowOnly = "Sertifikat \uDC00 BNSP";
    const trailingHigh = "Resume\uDBFF";
    const reversedPair = "Bad\uDC00\uD800Pair";

    expect(sanitizeExtractedText(highOnly)).toBe("Pengalaman  K3");
    expect(sanitizeExtractedText(lowOnly)).toBe("Sertifikat  BNSP");
    expect(sanitizeExtractedText(trailingHigh)).toBe("Resume");
    expect(sanitizeExtractedText(reversedPair)).toBe("BadPair");
  });

  it("preserves valid UTF-16 surrogate pairs such as emoji and Indonesian prose", () => {
    const valid = "📄 OK — Ringkasan CV Asesi (Sertifikasi K3)";
    expect(sanitizeExtractedText(valid)).toBe(valid);
  });
});
