const NIK_REGEX = /\b\d{16}\b/g;
const PHONE_REGEX = /(\+62|62|0)8\d{7,12}\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const DATA_IMAGE_REGEX = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g;
const ADDRESS_LINE_REGEX = /(?:^|\n)\s*(Alamat|Domisili|RT\s*\/?\s*RW)\s*:?[^\n]*/gi;

export function redactPii(text: string): string {
  return text
    .replace(DATA_IMAGE_REGEX, "[REDACTED_IMAGE]")
    .replace(NIK_REGEX, "[REDACTED_NIK]")
    .replace(PHONE_REGEX, "[REDACTED_PHONE]")
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    .replace(ADDRESS_LINE_REGEX, "\n$1: [REDACTED_ADDRESS]");
}

/**
 * Throws if sensitive PII markers (16-digit NIK or embedded image data)
 * remain in an outbound LLM payload.
 */
export function assertNoPiiLeak(payload: string): void {
  if (/\b\d{16}\b/.test(payload)) {
    throw new Error("REDACTION_FAILURE: 16-digit NIK detected in outbound LLM payload");
  }
  if (/data:image\//i.test(payload)) {
    throw new Error("REDACTION_FAILURE: Image data URI detected in outbound LLM payload");
  }
}

export interface JuryInputPayload {
  name_ktp_ocr: string;
  name_apl01: string;
  name_surat_tugas: string;
  name_ijazah: string;
  ocr_confidence: number;
  ocr_confidence_floor: number;
}

/**
 * Strict allow-list builder for Name Jury prompt (Rule 30 PDP exception).
 * Drops any NIK, address, phone, or image fields.
 */
export function buildJuryPayload(raw: JuryInputPayload): JuryInputPayload {
  return {
    name_ktp_ocr: redactPii(raw.name_ktp_ocr).trim(),
    name_apl01: redactPii(raw.name_apl01).trim(),
    name_surat_tugas: redactPii(raw.name_surat_tugas).trim(),
    name_ijazah: redactPii(raw.name_ijazah).trim(),
    ocr_confidence: raw.ocr_confidence,
    ocr_confidence_floor: raw.ocr_confidence_floor,
  };
}

export function formatPseudonym(zeroBasedIndex: number): string {
  const num = String(zeroBasedIndex + 1).padStart(3, "0");
  return `ASESI-${num}`;
}
