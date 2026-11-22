/**
 * Normalizes OCR confidence from either Tesseract's 0-100 scale or already-normalized
 * 0-1 values into a clamped [0, 1] float with 4-decimal precision for `NUMERIC(5,4)` storage.
 */
export function normalizeOcrConfidence(raw: number | null | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  const scaled = raw > 1 ? raw / 100 : raw;
  const clamped = Math.min(1, Math.max(0, scaled));
  return Number(clamped.toFixed(4));
}
