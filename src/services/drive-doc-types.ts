/**
 * Shared BNSP document taxonomy, filename/content DIT helpers, and token utilities
 * used consistently across classifier (`drive.ts`), revision dedup (`drive-revisions.ts`),
 * and candidate name normalization (`names.ts`).
 */

export interface DriveDocTypeSpec {
  singleton: boolean;
  defaultConfidence: number;
}

export const DRIVE_DOC_TYPES = {
  materi_pelatihan: { singleton: false, defaultConfidence: 0.92 },
  ktp: { singleton: true, defaultConfidence: 0.95 },
  apl01: { singleton: true, defaultConfidence: 0.95 },
  apl02: { singleton: true, defaultConfidence: 0.95 },
  "04a": { singleton: false, defaultConfidence: 0.92 },
  "04b": { singleton: false, defaultConfidence: 0.88 },
  "06a": { singleton: true, defaultConfidence: 0.92 },
  "06b": { singleton: true, defaultConfidence: 0.92 },
  "06c": { singleton: true, defaultConfidence: 0.92 },
  "09": { singleton: true, defaultConfidence: 0.88 },
  dit_form: { singleton: false, defaultConfidence: 0.9 },
  ijazah: { singleton: true, defaultConfidence: 0.9 },
  cv: { singleton: true, defaultConfidence: 0.9 },
  surat_tugas: { singleton: true, defaultConfidence: 0.9 },
  portofolio: { singleton: false, defaultConfidence: 0.85 },
  pas_foto: { singleton: true, defaultConfidence: 0.88 },
  sertifikat_pelatihan: { singleton: false, defaultConfidence: 0.82 },
  unknown: { singleton: false, defaultConfidence: 0.1 },
} as const satisfies Record<string, DriveDocTypeSpec>;

export type KnownDriveDocType = keyof typeof DRIVE_DOC_TYPES;

export const SINGLETON_DOC_TYPES: ReadonlySet<string> = new Set(
  Object.entries(DRIVE_DOC_TYPES)
    .filter(([, meta]) => meta.singleton)
    .map(([docType]) => docType),
);

export type DitFormKind =
  | "ibpr"
  | "erp"
  | "work_permit"
  | "inspeksi_p3k"
  | "inspeksi_apd"
  | "inspeksi"
  | "investigasi"
  | "generic";

export const KNOWN_FILE_EXT_STRIP_RE =
  /(?:\.(?:pdf|docx?|pptx?|xlsx?|csv|txt|zip|rar|7z|jpe?g|png|webp|gif|bmp|md))+$/i;

export const GENERIC_REVISION_TAG_RE =
  /\b(?:rev(?:isi)?[\s._-]*\d+|v\d+|final|fiks|fix|terbaru|updated?)\b/gi;

/**
 * Shared stop-words representing BNSP folders, artifacts, or task labels rather
 * than candidate person names. Imported by `names.ts` and `drive.ts` so both stay synced.
 */
export const NON_CANDIDATE_SHARED_TOKENS = [
  "tugas",
  "presentasi",
  "dit",
  "k3",
  "ak3",
  "ak3u",
  "kelompok",
  "pekerjaan",
  "form",
  "revisi",
  "final",
  "fiks",
  "fix",
  "pt",
] as const;

export function stripKnownFileExtensions(raw: string): string {
  return raw.replace(KNOWN_FILE_EXT_STRIP_RE, "");
}

export function normaliseFileTokens(raw: string, stripDuplicateTags = true): string {
  let out = stripKnownFileExtensions(raw.toLowerCase());
  if (stripDuplicateTags) {
    out = out.replace(/\(\d+\)|-v\d+|-\d+(?=$|\s)/g, "");
  }
  return out
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Single source of truth for detecting FR.IA.04A operational DIT worksheets across
 * filename classification, content classification, and revision-slot deduplication.
 */
export function detectDitFormKind(
  input: string,
  options?: { isContent?: boolean },
): DitFormKind | null {
  const norm = input
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!norm) return null;

  const isContent = Boolean(options?.isContent);

  if (/identifikasi\s*bahaya|penilaian\s*risiko|\bibpr\b|\bhiradc\b/.test(norm)) {
    return "ibpr";
  }
  if (/emergency\s*response|tanggap\s*darurat|(?:^|\s)erp(?:$|\s)/.test(norm)) {
    return "erp";
  }
  if (/work\s*permit|permit\s*kerja|izin\s*kerja/.test(norm)) {
    return "work_permit";
  }
  if (/inspeksi.*\bp3k\b|\bp3k\b/.test(norm)) {
    return "inspeksi_p3k";
  }
  if (/inspeksi.*\bapd\b|\bapd\b/.test(norm)) {
    return "inspeksi_apd";
  }
  if (/in[ve]*stigasi\s*kecelakaan|(?<!\S)in[ve]*stigasi(?!\S)/.test(norm)) {
    return "investigasi";
  }

  if (!isContent) {
    if (/form(?:ulir)?\s*inspeksi|\binspeksi\b/.test(norm)) {
      return "inspeksi";
    }
    if (/form(?:ulir)?\s*(?:ibpr|hiradc|erp|work\s*permit|permit\s*kerja|izin\s*kerja|in[ve]*stigasi)/.test(norm)) {
      return "generic";
    }
    if (/^[1-6][\s.]+form\b/.test(stripKnownFileExtensions(norm))) {
      return "generic";
    }
  }

  return null;
}

/**
 * Shared detector for Tugas DIT submission folders / tokens across filename rules and text fallback.
 */
export function isDitTaskContext(
  fileName: string,
  parentPath = "",
  options?: { broadTaskTokens?: boolean },
): boolean {
  const ppNorm = parentPath
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/tugas\s*dit|(?:^|\/)\s*tugas(?:\s|$|\/)/.test(ppNorm)) {
    return true;
  }

  const fnBase = normaliseFileTokens(fileName, true);
  if (options?.broadTaskTokens) {
    return /(?:^|\s)(?:dit|pekerjaan|penugasan|tugas)(?:$|\s)/.test(fnBase);
  }
  return /(?:^|\s)dit(?:$|\s)/.test(fnBase);
}
