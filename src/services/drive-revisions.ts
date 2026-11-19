export interface RevisionComparableFile {
  id?: string;
  fileName: string;
  docType: string;
  classificationConfidence?: number;
  driveModifiedTime?: string | null;
  extractedText?: string | null;
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 0,
  januari: 0,
  feb: 1,
  februari: 1,
  mar: 2,
  maret: 2,
  apr: 3,
  april: 3,
  mei: 4,
  may: 4,
  jun: 5,
  juni: 5,
  jul: 6,
  juli: 6,
  agu: 7,
  agustus: 7,
  aug: 7,
  sep: 8,
  sept: 8,
  september: 8,
  okt: 9,
  oktober: 9,
  oct: 9,
  nov: 10,
  november: 10,
  des: 11,
  desember: 11,
  dec: 11,
};

function parseValidDateMs(year: number, monthIndex0: number, day: number): number {
  if (year < 2000 || year > 2100 || monthIndex0 < 0 || monthIndex0 > 11 || day < 1 || day > 31) {
    return 0;
  }
  const ms = Date.UTC(year, monthIndex0, day);
  return Number.isFinite(ms) ? ms : 0;
}

export function extractDateMsFromFileName(fileName: string): number {
  let maxMs = 0;

  // ISO / YYYY-MM-DD / YYYY_MM_DD (underscore-safe: avoid \b between `_` and digit)
  for (const m of fileName.matchAll(/(?:^|[^0-9])(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})(?=$|[^0-9])/g)) {
    maxMs = Math.max(maxMs, parseValidDateMs(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  // DD-MM-YYYY or DD.MM.YYYY
  for (const m of fileName.matchAll(/(?:^|[^0-9])(\d{1,2})[-_.](\d{1,2})[-_.](20\d{2})(?=$|[^0-9])/g)) {
    maxMs = Math.max(maxMs, parseValidDateMs(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  }
  // Compact YYYYMMDD
  for (const m of fileName.matchAll(/(?:^|[^0-9])(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])(?=$|[^0-9])/g)) {
    maxMs = Math.max(maxMs, parseValidDateMs(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  // Text date: "19 Nov 2026"
  for (const m of fileName.toLowerCase().matchAll(/(?:^|[^0-9])(\d{1,2})\s+([a-z]+)\s+(20\d{2})(?=$|[^0-9])/g)) {
    const mon = MONTH_NAME_MAP[m[2] ?? ""];
    if (mon !== undefined) {
      maxMs = Math.max(maxMs, parseValidDateMs(Number(m[3]), mon, Number(m[1])));
    }
  }

  return maxMs;
}

export function extractExplicitRevisionRank(fileName: string): number {
  const lower = fileName.toLowerCase().replace(/\.[a-z0-9]{2,5}(?:\.[a-z0-9]{2,5})?$/i, "");
  let rank = 0;

  // Explicit version or revision tags outweigh plain duplicate "(1)" counters
  for (const m of lower.matchAll(/(?:^|[^a-z0-9])(?:rev(?:isi)?|ver(?:si)?|v)[\s._-]*(\d+)(?=$|[^a-z0-9])/g)) {
    rank = Math.max(rank, 1000 + Number(m[1] ?? 1) * 10);
  }
  if (rank === 0 && /(?:^|[^a-z0-9])revisi(?=$|[^a-z0-9])/.test(lower)) {
    rank = Math.max(rank, 1005);
  }
  if (/(?:^|[^a-z0-9])(?:final|fiks|fix|terbaru|updated?)(?=$|[^a-z0-9])/.test(lower)) {
    rank = Math.max(rank, rank > 0 ? rank + 5 : 500);
  }

  // Trailing Drive/OS duplicate counters "(1)", "(2)", "-1", "-2"
  const dupParen = lower.match(/\((\d+)\)\s*$/);
  if (dupParen) {
    rank += Math.min(Number(dupParen[1] ?? 1), 99);
  } else {
    const dupDash = lower.match(/[-_\s]+(\d)\s*$/);
    // Avoid mistaking "Kelompok 1" or "Pekerjaan 2" for a duplicate suffix
    if (dupDash && !/(?:kelompok|kp|pekerjaan|penugasan|tugas|form|part|bab)\s+\d\s*$/i.test(lower)) {
      rank += Math.min(Number(dupDash[1] ?? 1), 9);
    }
  }

  return rank;
}

/**
 * Sorts candidate files descending so index 0 is ALWAYS the newest authoritative revision:
 * 1. Explicit Google Drive / ZIP `driveModifiedTime` when available
 * 2. Embedded filename date
 * 3. Explicit revision / final / duplicate `(N)` rank
 * 4. Extracted text presence & filename deterministic tie-break
 */
export function compareDriveFileFreshnessDesc<T extends RevisionComparableFile>(
  a: T,
  b: T,
): number {
  const modA = a.driveModifiedTime ? Date.parse(a.driveModifiedTime) : NaN;
  const modB = b.driveModifiedTime ? Date.parse(b.driveModifiedTime) : NaN;
  const validModA = Number.isFinite(modA) ? modA : 0;
  const validModB = Number.isFinite(modB) ? modB : 0;

  if (validModA !== validModB) {
    return validModB - validModA;
  }

  const fnDateA = extractDateMsFromFileName(a.fileName);
  const fnDateB = extractDateMsFromFileName(b.fileName);
  if (fnDateA !== fnDateB) {
    return fnDateB - fnDateA;
  }

  const revA = extractExplicitRevisionRank(a.fileName);
  const revB = extractExplicitRevisionRank(b.fileName);
  if (revA !== revB) {
    return revB - revA;
  }

  const textLenA = a.extractedText?.trim().length ?? 0;
  const textLenB = b.extractedText?.trim().length ?? 0;
  if (textLenA !== textLenB) {
    return textLenB - textLenA;
  }

  return (b.classificationConfidence ?? 0) - (a.classificationConfidence ?? 0);
}

export function pickLatestDriveFile<T extends RevisionComparableFile>(
  files: T[],
): T | null {
  if (files.length === 0) return null;
  return [...files].sort(compareDriveFileFreshnessDesc)[0] ?? null;
}

const SINGLETON_DOC_TYPES = new Set([
  "06a",
  "06b",
  "06c",
  "09",
  "cv",
  "ktp",
  "apl01",
  "apl02",
  "ijazah",
  "surat_tugas",
  "pas_foto",
]);

/**
 * Computes a logical artifact slot so distinct multi-part files (e.g. Kelompok 1..4,
 * PEKERJAAN 1..4, or Form IBPR vs Form ERP vs Form Work Permit vs Investigasi) remain
 * distinct, while duplicate/revised copies of the same slot collapse to the newest one.
 */
export function extractMultiPartSlotKey(file: RevisionComparableFile): string {
  const dt = file.docType.toLowerCase();
  if (SINGLETON_DOC_TYPES.has(dt)) {
    return `singleton:${dt}`;
  }

  const clean = file.fileName
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}(?:\.[a-z0-9]{2,5})?$/i, "")
    .replace(/\(\d+\)\s*$/g, "")
    .replace(/\b(?:rev(?:isi)?[\s._-]*\d+|v\d+|final|fiks|fix|terbaru|updated?)\b/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (dt === "dit_form") {
    if (/\bibpr\b|\bhiradc\b/.test(clean)) return "dit_form:ibpr";
    if (/\berp\b|tanggap\s*darurat/.test(clean)) return "dit_form:erp";
    if (/work\s*permit|permit\s*kerja|izin\s*kerja/.test(clean)) return "dit_form:work_permit";
    if (/inspeksi.*\bp3k\b|\bp3k\b/.test(clean)) return "dit_form:inspeksi_p3k";
    if (/inspeksi.*\bapd\b|\bapd\b/.test(clean)) return "dit_form:inspeksi_apd";
    if (/in[ve]*stigasi|kecelakaan/.test(clean)) return "dit_form:investigasi";
  }

  if (dt === "04a" || dt === "04b") {
    const partMatch = clean.match(
      /\b(?:kelompok|kp|pekerjaan|penugasan|tugas|part|bagian)[\s._-]*(\d{1,2})\b/i,
    );
    if (partMatch?.[1]) {
      return `${dt}:part-${partMatch[1]}`;
    }
  }

  const dateStripped = clean
    .replace(/\b20\d{2}[-_.]?\d{1,2}[-_.]?\d{1,2}\b/g, "")
    .replace(/\b\d{1,2}[-_.]\d{1,2}[-_.]20\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return `${dt}:named:${dateStripped || file.fileName.toLowerCase()}`;
}

/**
 * Collapses duplicate revisions sharing the same logical artifact slot to ONLY the newest
 * version while keeping every distinct multi-part Kelompok Pekerjaan / form intact.
 */
export function deduplicateFilesByLatestRevision<T extends RevisionComparableFile>(
  files: T[],
): T[] {
  const bestBySlot = new Map<string, T>();
  for (const file of [...files].sort(compareDriveFileFreshnessDesc)) {
    const slot = extractMultiPartSlotKey(file);
    if (!bestBySlot.has(slot)) {
      bestBySlot.set(slot, file);
    }
  }
  return Array.from(bestBySlot.values());
}
