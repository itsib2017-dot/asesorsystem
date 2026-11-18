const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/**
 * Formats ISO dates (`YYYY-MM-DD` or ISO timestamps) to Indonesian blanko format
 * e.g. `12 November 2026`. Preserves non-ISO human strings untouched.
 */
export function formatAk05DateIndonesia(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Belum ditentukan";
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!m) return trimmed;
  const year = m[1];
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  const monthName = INDONESIAN_MONTHS[monthIdx];
  if (!monthName || Number.isNaN(day) || day < 1 || day > 31) return trimmed;
  return `${day} ${monthName} ${year}`;
}

/**
 * Formats scheme title for official BNSP FR.AK.05 header/footer cells
 * (strips SKM suffix and optional leading "Okupasi ").
 */
export function formatAk05SchemeTitle(raw: string): string {
  return raw
    .replace(/\s*\(SKM\/[^)]+\)/i, "")
    .replace(/^okupasi\s+/i, "")
    .trim()
    .toUpperCase();
}
