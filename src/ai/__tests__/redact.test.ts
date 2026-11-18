import { describe, it, expect } from "vitest";
import {
  redactPii,
  assertNoPiiLeak,
  buildJuryPayload,
  formatPseudonym,
} from "../redact";

describe("PII & NIK Redaction (QA SEC-03 & IDN-15)", () => {
  it("redacts 16-digit Indonesian NIK, phone numbers, emails, and base64 images", () => {
    const raw =
      "Nama: Andi\nNIK: 3174051234560001\nHP: 081234567890\nEmail: andi@example.com\nAlamat: Jl. Sudirman No 1\nFoto: data:image/png;base64,iVBORw0KGgo=";
    const clean = redactPii(raw);

    expect(clean).not.toContain("3174051234560001");
    expect(clean).not.toContain("081234567890");
    expect(clean).not.toContain("andi@example.com");
    expect(clean).not.toContain("Jl. Sudirman");
    expect(clean).not.toContain("iVBORw0KGgo=");
    expect(clean).toContain("[REDACTED_NIK]");
    expect(clean).toContain("[REDACTED_PHONE]");
    expect(clean).toContain("[REDACTED_EMAIL]");
    expect(clean).toContain("[REDACTED_IMAGE]");
  });

  it("throws REDACTION_FAILURE if an unredacted 16-digit NIK or image data URI reaches outbound check", () => {
    expect(() => assertNoPiiLeak("NIK peserta 3201012345670009")).toThrow(
      /REDACTION_FAILURE/,
    );
    expect(() => assertNoPiiLeak("data:image/jpeg;base64,abc")).toThrow(
      /REDACTION_FAILURE/,
    );
    expect(() => assertNoPiiLeak("Teks jawaban aman ASESI-001")).not.toThrow();
  });

  it("enforces strict allow-list for Name Jury payload (strips extra properties)", () => {
    const dirty = {
      name_ktp_ocr: "Declan Rice Pangabean 3174051234560001",
      name_apl01: "Declan Rice Pangabean",
      name_surat_tugas: "Declan Rice P.",
      name_ijazah: "Declan Rice Pangabean",
      ocr_confidence: 0.94,
      ocr_confidence_floor: 0.75,
      nik: "3174051234560001",
      ktp_image: "secret.jpg",
    } as unknown as Parameters<typeof buildJuryPayload>[0];

    const payload = buildJuryPayload(dirty);
    const json = JSON.stringify(payload);

    expect(json).not.toContain("3174051234560001");
    expect(json).not.toContain("secret.jpg");
    expect(Object.keys(payload)).toEqual([
      "name_ktp_ocr",
      "name_apl01",
      "name_surat_tugas",
      "name_ijazah",
      "ocr_confidence",
      "ocr_confidence_floor",
    ]);
  });

  it("formats pseudonyms consistently", () => {
    expect(formatPseudonym(0)).toBe("ASESI-001");
    expect(formatPseudonym(22)).toBe("ASESI-023");
  });
});
