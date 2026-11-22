import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import { inferMimeTypeFromFileName } from "@/services/extract";
import {
  DRIVE_DOC_TYPES,
  NON_CANDIDATE_SHARED_TOKENS,
  detectDitFormKind,
  isDitTaskContext,
  normaliseFileTokens,
  stripKnownFileExtensions,
  type KnownDriveDocType,
} from "@/services/drive-doc-types";

export interface ClassifiedDriveFile {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  drivePath: string;
  docType: string;
  confidence: number;
  classificationReason?: string;
  modifiedTime?: string | null;
}

export interface ClassificationResult {
  docType: string;
  confidence: number;
  reason: string;
}

export interface SchemeFormClassifierEntry {
  formKey: string;
  formName?: string;
  filePatterns: string[];
  instrumentRole: string;
  sortOrder: number;
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveSchemeFormDocType(form: SchemeFormClassifierEntry): string {
  const cleanedKey = form.formKey
    .trim()
    .toLowerCase()
    .replace(/^fr[\s._-]*/i, "")
    .replace(/^ia[\s._-]*/i, "")
    .replace(/[._-]+/g, "");
  if (
    cleanedKey === "04a" ||
    cleanedKey === "04b" ||
    cleanedKey === "06a" ||
    cleanedKey === "06b" ||
    cleanedKey === "06c" ||
    cleanedKey === "09" ||
    cleanedKey === "apl01" ||
    cleanedKey === "apl02" ||
    cleanedKey === "ak01" ||
    cleanedKey === "ak02" ||
    cleanedKey === "ak05"
  ) {
    return cleanedKey;
  }
  return form.formKey.trim().toLowerCase();
}

function isExplicit04aSignal(fnBase: string): boolean {
  return /(?:^|\s)04a(?:$|\s)|ia[\s.]*04a|instruksi\s*terstruktur|daftar\s*instruksi|soal\s*dit|panduan\s*(?:tugas\s*)?dit/i.test(
    fnBase,
  );
}

function isPresentationDeckContext(ctx: NameMatchContext): boolean {
  return (
    /\.pptx?$/i.test(ctx.fnLower) ||
    /\b(?:presentasi|paparan|slide|04b)\b/i.test(ctx.fnBase)
  );
}

function matchSchemeFormsByName(
  ctx: NameMatchContext,
  schemeForms?: SchemeFormClassifierEntry[],
): ClassificationResult | null {
  if (!Array.isArray(schemeForms) || schemeForms.length === 0) return null;
  const fnNorm = ctx.fnBase.replace(/\./g, " ").replace(/\s+/g, " ").trim();
  const ordered = [...schemeForms].sort((a, b) => a.sortOrder - b.sortOrder);
  const explicit04a = isExplicit04aSignal(ctx.fnBase);
  const isPresentation = isPresentationDeckContext(ctx);
  const isDitWorksheet = detectDitFormKind(ctx.fnBase, { isContent: false }) !== null;

  // Pass 1: filename matches across all scheme forms before falling back to parent-folder tokens
  for (const form of ordered) {
    const resolvedDocType = resolveSchemeFormDocType(form);
    for (const rawPattern of form.filePatterns ?? []) {
      const patNorm = rawPattern
        .toLowerCase()
        .replace(/[._-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!patNorm) continue;
      if (
        resolvedDocType === "04a" &&
        patNorm === "dit" &&
        !explicit04a &&
        (isPresentation || isDitWorksheet)
      ) {
        continue;
      }

      const boundaryRe = new RegExp(`(?:^|\\s|/)${escapeRegExp(patNorm)}(?:$|\\s|/)`, "i");
      if (boundaryRe.test(fnNorm)) {
        return {
          docType: resolvedDocType,
          confidence: 0.94,
          reason: `Cocok dengan pola manifes skema (${form.formKey}: "${rawPattern}")`,
        };
      }
    }
  }

  // Pass 2: parent-folder matches (never override presentation decks/DIT worksheets into 04a)
  for (const form of ordered) {
    const resolvedDocType = resolveSchemeFormDocType(form);
    if (resolvedDocType === "04a" && !explicit04a && (isPresentation || isDitWorksheet)) {
      continue;
    }
    for (const rawPattern of form.filePatterns ?? []) {
      const patNorm = rawPattern
        .toLowerCase()
        .replace(/[._-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!patNorm) continue;

      const boundaryRe = new RegExp(`(?:^|\\s|/)${escapeRegExp(patNorm)}(?:$|\\s|/)`, "i");
      const matchesFolder =
        (patNorm.includes(" ") || patNorm.length >= 6) && boundaryRe.test(ctx.ppNorm);

      if (matchesFolder) {
        return {
          docType: resolvedDocType,
          confidence: 0.94,
          reason: `Cocok dengan pola manifes skema (${form.formKey}: "${rawPattern}")`,
        };
      }
    }
  }

  return null;
}

const DRIVE_FOLDER_ID_REGEX = /\/folders\/([a-zA-Z0-9_-]+)/;
const SHEET_ID_REGEX = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;

export function extractDriveFolderId(url: string): string | null {
  const check = validateSafeExternalUrl(url, ["drive.google.com"]);
  if (!check.safe) {
    throw new Error(`INVALID_DRIVE_URL: ${check.reason}`);
  }
  const match = url.match(DRIVE_FOLDER_ID_REGEX);
  return match?.[1] ?? null;
}

export function extractGoogleSheetId(url: string): string | null {
  const check = validateSafeExternalUrl(url, ["docs.google.com", "drive.google.com"]);
  if (!check.safe) {
    throw new Error(`INVALID_SHEET_URL: ${check.reason}`);
  }
  const match = url.match(SHEET_ID_REGEX);
  return match?.[1] ?? null;
}

interface NameMatchContext {
  fnLower: string;
  fnBase: string;
  rawBaseName: string;
  ppNorm: string;
}

interface UnifiedClassifierRule {
  docType: KnownDriveDocType;
  confidence: number;
  matchesName?: (ctx: NameMatchContext) => boolean;
  nameReason?: string;
  contentPattern?: RegExp;
  contentReason?: string;
}

const UNIFIED_CLASSIFIER_RULES: Readonly<Record<string, UnifiedClassifierRule>> = {
  materi_pelatihan: {
    docType: "materi_pelatihan",
    confidence: DRIVE_DOC_TYPES.materi_pelatihan.defaultConfidence,
    matchesName: ({ ppNorm, fnBase }) =>
      /(?:^|\/)\s*materi(?:\s|$|\/)/i.test(ppNorm) ||
      /^(?:cover\s+materi|silabus|tata\s*tertib|\d+(?:\s*&\s*\d+)?\.\s*ahli\s*k3|modul\b|materi\b|handout\b|bahan\s*ajar\b|\d+\.\s*pengantar\s*pelatihan\b)/i.test(
        fnBase,
      ),
    nameReason: "Materi atau silabus pelatihan",
  },
  template_muk: {
    docType: "template_muk",
    confidence: DRIVE_DOC_TYPES.template_muk.defaultConfidence,
    matchesName: ({ fnBase }) =>
      /\bfr[\s.]*(?:mapa[\s.]*0?[12]|va|ak[\s.]*0?[1-7]|ia[\s.]*(?:0?7|0?8|10))\b|\bdaftar\s*periksa\s*muk\b|\bpeta\s*kelompok\s*pekerjaan\b|\bskkni\b|\bskema\s*sertifikasi\b|\bberita\s*acara\b|\bdaftar\s*hadir\b/i.test(
        fnBase,
      ),
    nameReason: "Template / dokumen administrasi MUK LSP",
  },
  ktp: {
    docType: "ktp",
    confidence: DRIVE_DOC_TYPES.ktp.defaultConfidence,
    matchesName: ({ fnBase }) =>
      /(?:^|\s)ktpp?(?:$|\s)|kartu\s*tanda\s*penduduk|(?:^|\s)nik(?:$|\s)/i.test(fnBase),
    nameReason: "Dokumen identitas KTP",
    contentPattern:
      /kartu\s*tanda\s*penduduk|nik\s*:?\s*\d{12,16}|provinsi[\s\S]{0,60}kabupaten|gol\.?\s*darah/i,
    contentReason: "Terdeteksi dari hasil OCR/teks: dokumen identitas KTP",
  },
  apl01: {
    docType: "apl01",
    confidence: DRIVE_DOC_TYPES.apl01.defaultConfidence,
    matchesName: ({ fnBase }) => /apl[\s.]*0?1|permohonan\s*sertifikasi/i.test(fnBase),
    nameReason: "Formulir permohonan FR.APL.01",
    contentPattern: /\bfr[\s._-]*apl[\s._-]*01\b|permohonan\s*sertifikasi\s*kompetensi/i,
    contentReason: "Terdeteksi dari isi dokumen: formulir FR.APL.01",
  },
  apl02: {
    docType: "apl02",
    confidence: DRIVE_DOC_TYPES.apl02.defaultConfidence,
    matchesName: ({ fnBase }) => /apl[\s.]*0?2|asesmen\s*mandiri/i.test(fnBase),
    nameReason: "Formulir asesmen mandiri FR.APL.02",
    contentPattern: /\bfr[\s._-]*apl[\s._-]*02\b|asesmen\s*mandiri/i,
    contentReason: "Terdeteksi dari isi dokumen: formulir FR.APL.02",
  },
  "04a": {
    docType: "04a",
    confidence: DRIVE_DOC_TYPES["04a"].defaultConfidence,
    matchesName: ({ fnBase }) =>
      /(?:^|\s)04a(?:$|\s)|ia[\s.]*04a|instruksi\s*terstruktur|daftar\s*instruksi|soal\s*dit|panduan\s*(?:tugas\s*)?dit/i.test(
        fnBase,
      ),
    nameReason: "Daftar Instruksi Terstruktur FR.IA.04A",
    contentPattern:
      /\bfr[\s._-]*ia[\s._-]*04a\b|daftar\s*instruksi\s*terstruktur|penjelasan\s*proyek\s*singkat/i,
    contentReason: "Terdeteksi dari isi dokumen: memuat judul/formulir FR.IA.04A",
  },
  "04b_explicit": {
    docType: "04b",
    confidence: DRIVE_DOC_TYPES["04b"].defaultConfidence,
    matchesName: ({ fnBase }) =>
      /(?:^|\s)04b(?:$|\s)|ia[\s.]*04b|observasi\s*demonstrasi|presentasi|paparan/i.test(
        fnBase,
      ),
    nameReason: "Presentasi / Demonstrasi DIT FR.IA.04B",
    contentPattern: /\bfr[\s._-]*ia[\s._-]*04b\b|penilaian\s*proyek\s*singkat/i,
    contentReason: "Terdeteksi dari isi dokumen: memuat FR.IA.04B",
  },
  "06a": {
    docType: "06a",
    confidence: DRIVE_DOC_TYPES["06a"].defaultConfidence,
    matchesName: ({ fnBase }) => /(?:^|\s)06a(?:$|\s)|ia[\s.]*06a/i.test(fnBase),
    nameReason: "Soal tertulis FR.IA.06A",
    contentPattern: /\bfr[\s._-]*ia[\s._-]*06a\b|daftar\s*pertanyaan\s*tertulis/i,
    contentReason: "Terdeteksi dari isi dokumen: soal tertulis FR.IA.06A",
  },
  "06b": {
    docType: "06b",
    confidence: DRIVE_DOC_TYPES["06b"].defaultConfidence,
    matchesName: ({ fnBase }) =>
      /(?:^|\s)06b(?:$|\s)|ia[\s.]*06b|(?:^|\s)kunci(?:$|\s)/i.test(fnBase),
    nameReason: "Kunci jawaban FR.IA.06B",
    contentPattern: /\bfr[\s._-]*ia[\s._-]*06b\b|kunci\s*jawaban\s*pertanyaan\s*tertulis/i,
    contentReason: "Terdeteksi dari isi dokumen: kunci jawaban FR.IA.06B",
  },
  "06c": {
    docType: "06c",
    confidence: DRIVE_DOC_TYPES["06c"].defaultConfidence,
    matchesName: ({ fnBase }) =>
      /(?:^|\s)06c(?:$|\s)|ia[\s.]*06c|(?:^|\s)jawaban(?:$|\s)/i.test(fnBase),
    nameReason: "Lembar jawaban tertulis FR.IA.06C",
    contentPattern: /\bfr[\s._-]*ia[\s._-]*06c\b|lembar\s*jawaban\s*tertulis/i,
    contentReason: "Terdeteksi dari isi dokumen: lembar jawaban FR.IA.06C",
  },
  "09": {
    docType: "09",
    confidence: DRIVE_DOC_TYPES["09"].defaultConfidence,
    matchesName: ({ fnBase }) => /fr[\s.]*ia[\s.]*09|ia[\s.]*09|wawancara/i.test(fnBase),
    nameReason: "Formulir wawancara FR.IA.09",
    contentPattern: /\bfr[\s._-]*ia[\s._-]*09\b|daftar\s*pertanyaan\s*wawancara/i,
    contentReason: "Terdeteksi dari isi dokumen: formulir wawancara FR.IA.09",
  },
  "04b_slides": {
    docType: "04b",
    confidence: DRIVE_DOC_TYPES["04b"].defaultConfidence,
    matchesName: ({ fnLower, fnBase, ppNorm }) =>
      /\.pptx?$/i.test(fnLower) &&
      !isExplicit04aSignal(fnBase) &&
      !/\b(?:materi|silabus|modul|handout|bahan\s*ajar)\b/i.test(fnBase) &&
      !/(?:^|\/)\s*materi(?:\s|$|\/)/i.test(ppNorm) &&
      (isDitTaskContext(fnLower, ppNorm, { broadTaskTokens: true }) ||
        /\.pptx?$/i.test(fnLower)),
    nameReason: "Salindia presentasi / penugasan DIT (.ppt/.pptx)",
  },
  dit_form: {
    docType: "dit_form",
    confidence: DRIVE_DOC_TYPES.dit_form.defaultConfidence,
    matchesName: ({ fnLower, fnBase }) =>
      !/\.zip$|\.rar$/i.test(fnLower) &&
      detectDitFormKind(fnBase, { isContent: false }) !== null,
    nameReason:
      "Formulir pendukung tugas DIT FR.IA.04A (IBPR/HIRADC, ERP, Work Permit, Inspeksi, atau Investigasi)",
    contentReason:
      "Terdeteksi dari isi dokumen: formulir kerja tugas DIT (IBPR/HIRADC/ERP/Work Permit/Inspeksi/Investigasi)",
  },
  ijazah: {
    docType: "ijazah",
    confidence: DRIVE_DOC_TYPES.ijazah.defaultConfidence,
    matchesName: ({ fnBase }) =>
      /ijaz?ah|ijasah|ijajah|transkrip\s*nilai|sertifikat\s*kelulusan|surat\s*keterangan\s*(?:ll?ulus|kuliah|pendidikan)|\bsu?ket\s*(?:ll?ulus|s\s*[123])|\bs\s*[12]\b/i.test(
        fnBase,
      ),
    nameReason: "Ijazah / surat keterangan pendidikan",
    contentPattern:
      /ijas?zah|surat\s*keterangan\s*(?:lulus|mahasiswa|kuliah)|transkrip\s*nilai|program\s*studi|magister|sarjana/i,
    contentReason: "Terdeteksi dari isi dokumen: ijazah / surat keterangan studi",
  },
  cv: {
    docType: "cv",
    confidence: DRIVE_DOC_TYPES.cv.defaultConfidence,
    matchesName: ({ fnBase, rawBaseName }) =>
      /\b(?:cv|drh|resume|biodata)\b|curr?iculum\s*vitae|daftar\s*riwayat\s*hidup|riwayat\s*hidup|\bdata\s*diri\b/i.test(
        fnBase,
      ) || /(?:^|[\s._-])(?:CV|cv)(?:[A-Z][a-z]+|\d+)/.test(rawBaseName.trim()),
    nameReason: "Daftar riwayat hidup (CV)",
    contentPattern:
      /daftar\s*riwayat\s*hidup|riwayat\s*hidup|curr?iculum\s*vitae|riwayat\s*pendidikan|pengalaman\s*kerja|work\s*experience|education(?:al)?\s*background|personal\s*profile|biodata\s*peserta/i,
    contentReason: "Terdeteksi dari isi dokumen: riwayat hidup / CV",
  },
  surat_tugas: {
    docType: "surat_tugas",
    confidence: DRIVE_DOC_TYPES.surat_tugas.defaultConfidence,
    matchesName: ({ fnBase }) =>
      /surat\s*(?:tugas|perintah|ket(?:erangan)?\s*(?:be)?kerja|ke\s*kerja|pengalaman|kenaikan\s*pangkat)|\bsk\s*(?:kerja|pns|pppk|kepangkatan|kenaikan\s*pangkat|gol|3[ab]|i{1,3}[\s.]*[a-d]|iv[\s.]*[a-e])|\bketerangan\s*(?:be)?kerja\b|^sk$|\bst\b/i.test(
        fnBase,
      ),
    nameReason: "Surat tugas / SK / surat keterangan kerja",
    contentPattern:
      /surat\s*tugas|surat\s*keterangan\s*kerja|kenaikan\s*pangkat|memutuskan\s*:|mengangkat\s*sdr/i,
    contentReason: "Terdeteksi dari isi dokumen: surat tugas / SK kepegawaian",
  },
  portofolio: {
    docType: "portofolio",
    confidence: DRIVE_DOC_TYPES.portofolio.defaultConfidence,
    matchesName: ({ fnBase }) =>
      /portofolio|paklaring|jobdesc|laporan\s*kerja|pengalaman\s*lapangan/i.test(fnBase),
    nameReason: "Dokumen portofolio / pengalaman kerja asesi",
  },
  pas_foto: {
    docType: "pas_foto",
    confidence: DRIVE_DOC_TYPES.pas_foto.defaultConfidence,
    matchesName: ({ fnBase }) =>
      /pas+\s*p?f?oto|foto\s*3x4|(?:^|\s)(?:photo|foto)(?:$|\s)|latar\s*merah|bg\s*merah|merah\s*batik|fococlipping/i.test(
        fnBase,
      ),
    nameReason: "Pas foto asesi",
  },
  sertifikat_pelatihan: {
    docType: "sertifikat_pelatihan",
    confidence: DRIVE_DOC_TYPES.sertifikat_pelatihan.defaultConfidence,
    matchesName: ({ fnBase }) => /sertifikat|pelatihan|pembinaan/i.test(fnBase),
    nameReason: "Sertifikat pelatihan / pembinaan",
  },
  "04b_multiformat": {
    docType: "04b",
    confidence: DRIVE_DOC_TYPES["04b"].defaultConfidence,
    matchesName: ({ fnLower, ppNorm }) =>
      /\.(pptx?|pdf|docx?)$/i.test(fnLower) &&
      isDitTaskContext(fnLower, ppNorm, { broadTaskTokens: false }),
    nameReason: "Dokumen penugasan / proyek DIT (.pptx/.pdf/.docx)",
    contentReason: "Terdeteksi dari isi dokumen dalam folder Tugas DIT",
  },
};

const NAME_RULE_ORDER = [
  "materi_pelatihan",
  "template_muk",
  "ktp",
  "apl01",
  "apl02",
  "04a",
  "04b_explicit",
  "06a",
  "06b",
  "06c",
  "09",
  "04b_slides",
  "dit_form",
  "ijazah",
  "cv",
  "surat_tugas",
  "portofolio",
  "pas_foto",
  "sertifikat_pelatihan",
  "04b_multiformat",
] as const;

const CONTENT_CODE_RULE_ORDER = [
  "04a",
  "04b_explicit",
  "apl01",
  "apl02",
  "06c",
  "06b",
  "06a",
  "09",
] as const;

const CONTENT_ADMIN_RULE_ORDER = ["cv", "ktp", "surat_tugas", "ijazah"] as const;

/**
 * Classifies messy BNSP Drive filenames into normalized document types (M1.2).
 * Handles duplicate markers (1), -2, -v2 and double extensions (.jpg.jpeg).
 * Evaluates filename tokens with strict word boundaries first so parent folders
 * like "Persyaratan Pelatihan" never override individual assessee documents, and
 * separates instructional "Materi" handouts from trainee forms/certificates.
 */
const PRIORITY_IDENTITY_AND_MATERIAL_RULES = [
  "materi_pelatihan",
  "ktp",
  "ijazah",
  "cv",
  "surat_tugas",
  "pas_foto",
] as const;

export function classifyDriveFileName(
  fileName: string,
  parentPath = "",
  schemeForms?: SchemeFormClassifierEntry[],
): ClassificationResult {
  const fnLower = fileName.toLowerCase();
  const fnBase = normaliseFileTokens(fileName, true);
  const rawBaseName = stripKnownFileExtensions(fileName);
  const ppNorm = parentPath
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const ctx: NameMatchContext = { fnLower, fnBase, rawBaseName, ppNorm };

  if (schemeForms && schemeForms.length > 0) {
    for (const key of PRIORITY_IDENTITY_AND_MATERIAL_RULES) {
      const rule = UNIFIED_CLASSIFIER_RULES[key];
      if (rule?.matchesName?.(ctx) && rule.nameReason) {
        return {
          docType: rule.docType,
          confidence: rule.confidence,
          reason: rule.nameReason,
        };
      }
    }

    const byScheme = matchSchemeFormsByName(ctx, schemeForms);
    if (byScheme) {
      return byScheme;
    }
  }

  for (const key of NAME_RULE_ORDER) {
    const rule = UNIFIED_CLASSIFIER_RULES[key];
    if (rule?.matchesName?.(ctx) && rule.nameReason) {
      return {
        docType: rule.docType,
        confidence: rule.confidence,
        reason: rule.nameReason,
      };
    }
  }

  if (/\.(zip|rar|7z)$/i.test(fnLower)) {
    return {
      docType: "unknown",
      confidence: 0.15,
      reason: "Arsip terkompresi — isi berkas dapat diekstrak/dipindai otomatis untuk .zip",
    };
  }

  return {
    docType: "unknown",
    confidence: DRIVE_DOC_TYPES.unknown.defaultConfidence,
    reason:
      "Nama berkas tidak mencerminkan jenis dokumen BNSP — gunakan Deteksi Isi & OCR atau pilih manual di Triage",
  };
}

/**
 * Classifies a document using extracted text/OCR content rather than relying solely
 * on potentially messy or generic filenames ("don't just judge by filename").
 */
export function classifyDocumentTextContent(
  rawText: string,
  fileName: string,
  parentPath = "",
  schemeForms?: SchemeFormClassifierEntry[],
): ClassificationResult | null {
  const norm = rawText.replace(/\s+/g, " ").trim();
  if (norm.length < 15) return null;

  const lower = norm.toLowerCase();

  if (Array.isArray(schemeForms) && schemeForms.length > 0) {
    const ordered = [...schemeForms].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const form of ordered) {
      for (const rawPattern of form.filePatterns ?? []) {
        const patNorm = rawPattern
          .toLowerCase()
          .replace(/[._-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (patNorm.length < 4) continue;
        const re = new RegExp(`\\b${escapeRegExp(patNorm)}\\b`, "i");
        if (re.test(lower)) {
          return {
            docType: resolveSchemeFormDocType(form),
            confidence: 0.91,
            reason: `Terdeteksi dari isi dokumen sesuai manifes skema (${form.formKey}: "${rawPattern}")`,
          };
        }
      }
    }
  }

  for (const key of CONTENT_CODE_RULE_ORDER) {
    const rule = UNIFIED_CLASSIFIER_RULES[key];
    if (rule?.contentPattern?.test(lower) && rule.contentReason) {
      return {
        docType: rule.docType,
        confidence: rule.confidence,
        reason: rule.contentReason,
      };
    }
  }

  if (/\bdaftar\s*riwayat\s*hidup\b|\bcurr?iculum\s*vitae\b|\briwayat\s*hidup\b/i.test(lower)) {
    const cvRule = UNIFIED_CLASSIFIER_RULES.cv!;
    return {
      docType: cvRule.docType,
      confidence: cvRule.confidence,
      reason: cvRule.contentReason!,
    };
  }

  if (detectDitFormKind(lower, { isContent: true }) !== null) {
    if (/\.pptx?$/i.test(fileName)) {
      return {
        docType: "04b",
        confidence: DRIVE_DOC_TYPES["04b"].defaultConfidence,
        reason: "Terdeteksi dari isi salindia: paparan tugas DIT K3",
      };
    }
    const ditRule = UNIFIED_CLASSIFIER_RULES.dit_form!;
    return {
      docType: ditRule.docType,
      confidence: ditRule.confidence,
      reason: ditRule.contentReason!,
    };
  }

  for (const key of CONTENT_ADMIN_RULE_ORDER) {
    const rule = UNIFIED_CLASSIFIER_RULES[key];
    if (rule?.contentPattern?.test(lower) && rule.contentReason) {
      return {
        docType: rule.docType,
        confidence: rule.confidence,
        reason: rule.contentReason,
      };
    }
  }

  if (
    isDitTaskContext(fileName, parentPath, { broadTaskTokens: false }) &&
    /\.(pptx?|pdf|docx?)$/i.test(fileName)
  ) {
    const multiRule = UNIFIED_CLASSIFIER_RULES["04b_multiformat"]!;
    return {
      docType: multiRule.docType,
      confidence: multiRule.confidence,
      reason: multiRule.contentReason!,
    };
  }

  return null;
}

/**
 * Extracts clean participant display names from FR.APL.01 / Surat Tugas text when present
 * (adapted from MUK helper — exposes names only, never unmasked NIK/phone).
 */
/**
 * Known APL.01 name label patterns observed across BNSP blanko variants.
 * The owner's APL.01 may use a label other than "Nama lengkap:". All patterns
 * are server-side only; never log the full matched value if it contains PII
 * beyond the name itself (NIK/KTP are deliberately excluded from the capture group).
 */
const APL01_NAME_LABEL_RE =
  /(?:Nama\s*(?:lengkap|peserta|asesi)?|Nama\s*Agan|Nama\s*yang\s*Daftar|Peserta\s*(?:dengan\s*Nama)?)\s*:?\s*([A-Za-z][A-Za-z\s.,'()-]{2,80})/gi;

export function extractCandidateNamesFromDocumentText(
  docType: string,
  text: string,
): string[] {
  const names: string[] = [];
  if (docType === "apl01") {
    for (const m of text.matchAll(APL01_NAME_LABEL_RE)) {
      const val = m[1]?.split(/\r?\n|No\.?\s*KTP|NIK|Tempat/i)[0]?.trim();
      if (val && val.length >= 3) names.push(val);
    }
  }
  if (docType === "surat_tugas") {
    const afterList = text.split(/DAFTAR\s+PESERTA/i).pop() ?? "";
    if (afterList && afterList.length < text.length) {
      for (const m of afterList.matchAll(/^\s*\d+\.\s+([A-Za-z][A-Za-z\s.,'()-]{2,70})/gm)) {
        const val = m[1]?.trim();
        if (val && !/^(asesor|tuk|tanggal|skema)/i.test(val)) names.push(val);
      }
    }
  }
  return Array.from(new Set(names));
}

/**
 * Crawls a public Google Drive folder recursively with Drive API v3 (pageSize 100)
 * and exponential backoff on 429/403 rate limits. Automatically falls back to the
 * keyless public `embeddedfolderview` HTML listing when no API key is configured or
 * when Google Drive API v3 returns 400/401/403/404.
 */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, "/")
    .trim();
}

export async function crawlPublicDriveFolderEmbedded(
  folderId: string,
  parentPath = "",
  depth = 0,
  schemeForms?: SchemeFormClassifierEntry[],
): Promise<ClassifiedDriveFile[]> {
  if (depth > 4) return [];

  const targetUrl = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
  const ssrf = validateSafeExternalUrl(targetUrl, ["drive.google.com"]);
  if (!ssrf.safe) {
    throw new Error(`INVALID_DRIVE_URL: ${ssrf.reason}`);
  }

  const res = await fetch(targetUrl, {
    headers: { "User-Agent": "AsesorKompetensi/1.4 (+https://assessor-zeta.vercel.app)" },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    if (depth > 0) {
      console.warn(
        `[Drive Crawl Warning] Skipping subfolder ${folderId} (${parentPath}): HTTP ${res.status}`,
      );
      return [];
    }
    throw new Error(`Drive public listing error: HTTP ${res.status}`);
  }

  const html = await res.text();
  const entryRegex =
    /<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g;

  const files: ClassifiedDriveFile[] = [];
  const subfolders: Array<{ id: string; path: string }> = [];

  for (const match of html.matchAll(entryRegex)) {
    const entryId = (match[1] ?? "").trim();
    const href = (match[2] ?? "").trim();
    const rawTitle = (match[3] ?? "").trim();
    const name = decodeHtmlEntities(rawTitle);
    if (!entryId || !name) continue;

    const currentPath = parentPath ? `${parentPath}/${name}` : name;
    if (href.includes("/drive/folders/")) {
      subfolders.push({ id: entryId, path: currentPath });
    } else {
      const { docType, confidence, reason } = classifyDriveFileName(
        name,
        parentPath,
        schemeForms,
      );
      files.push({
        driveFileId: entryId,
        fileName: name,
        mimeType: inferMimeTypeFromFileName(name),
        drivePath: currentPath,
        docType,
        confidence,
        classificationReason: reason,
        modifiedTime: null,
      });
    }
  }

  // Bounded concurrency across subfolders to avoid hitting serverless limits
  const CONCURRENCY = 6;
  for (let i = 0; i < subfolders.length; i += CONCURRENCY) {
    const chunk = subfolders.slice(i, i + CONCURRENCY);
    const nestedLists = await Promise.all(
      chunk.map((sf) =>
        crawlPublicDriveFolderEmbedded(sf.id, sf.path, depth + 1, schemeForms),
      ),
    );
    for (const nested of nestedLists) {
      files.push(...nested);
    }
  }

  return files;
}

async function crawlPublicDriveFolderApi(params: {
  folderId: string;
  apiKey: string;
  parentPath?: string;
  schemeForms?: SchemeFormClassifierEntry[];
}): Promise<ClassifiedDriveFile[]> {
  const results: ClassifiedDriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const query = encodeURIComponent(`'${params.folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=nextPageToken,files(id,name,mimeType,modifiedTime)&pageSize=100${
      pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
    }&key=${encodeURIComponent(params.apiKey)}`;

    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.status !== 429 && res.status !== 403) break;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }

    if (!res || !res.ok) {
      throw new Error(`Drive API error: HTTP ${res?.status ?? 503}`);
    }

    const body = (await res.json()) as {
      nextPageToken?: string;
      files?: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string }>;
    };

    for (const f of body.files ?? []) {
      const currentPath = params.parentPath ? `${params.parentPath}/${f.name}` : f.name;
      if (f.mimeType === "application/vnd.google-apps.folder") {
        const nested = await crawlPublicDriveFolderApi({
          folderId: f.id,
          apiKey: params.apiKey,
          parentPath: currentPath,
          schemeForms: params.schemeForms,
        });
        results.push(...nested);
      } else {
        const { docType, confidence, reason } = classifyDriveFileName(
          f.name,
          params.parentPath,
          params.schemeForms,
        );
        results.push({
          driveFileId: f.id,
          fileName: f.name,
          mimeType: f.mimeType,
          drivePath: currentPath,
          docType,
          confidence,
          classificationReason: reason,
          modifiedTime: f.modifiedTime ?? null,
        });
      }
    }

    pageToken = body.nextPageToken;
  } while (pageToken);

  return results;
}

export async function crawlPublicDriveFolder(params: {
  folderId: string;
  apiKey?: string;
  parentPath?: string;
  schemeForms?: SchemeFormClassifierEntry[];
}): Promise<ClassifiedDriveFile[]> {
  const key = params.apiKey?.trim();
  if (key) {
    try {
      return await crawlPublicDriveFolderApi({
        folderId: params.folderId,
        apiKey: key,
        parentPath: params.parentPath,
        schemeForms: params.schemeForms,
      });
    } catch {
      // Fall through to keyless public HTML listing when key is restricted/invalid
    }
  }

  return crawlPublicDriveFolderEmbedded(
    params.folderId,
    params.parentPath ?? "",
    0,
    params.schemeForms,
  );
}

const EXTRA_NON_CANDIDATE_FOLDER_RE =
  /^(?:materi|pelatihan|persyaratan|tugas\s*dit|skema|muk|kelengkapan|dokumen(?:\s*uji)?|kelompok(?:\s*pekerjaan)?|form(?:ulir)?|ibpr|hiradc|erp|work\s*permit|inspeksi|investigasi|arsip|template|online|onsite|sertifikasi|bnsp|batch|ujian|soal|kunci|jawaban|lampiran|berkas|folder|ahli\s*k3)\b|^(?:ba|docs|_docs_|asesmen|metode|lsp|umum)$/i;

const STRUCTURAL_FOLDER_CONTAINS_RE =
  /\b(?:pelatihan|sertifikasi|bnsp|materi|skema|dokumen\s*uji|kelengkapan|persyaratan|kelompok\s*pekerjaan)\b/i;

const TASK_OR_FOLDER_NAME_PREFIX_RE =
  /^(?:tugas\s*presentasi\s*dit|tugas\s*dit|tugas\s*\d+|tugas|dit|presentasi|kelompok(?:\s*pekerjaan)?\s*\d*|form(?:ulir)?)\b/i;

const SHARED_NON_CANDIDATE_TOKEN_SET = new Set<string>(NON_CANDIDATE_SHARED_TOKENS);

/**
 * Known status/suffix catatan that pollute real person folder names (e.g.
 * "Budi Santoso - Kurang Sertifikat Pelatihan"). Stripped before the structural
 * folder filter so a person-named folder is not discarded merely because its
 * status suffix contains a structural word like "pelatihan".
 */
const STATUS_SUFFIX_RE =
  /\s*(?:-\s*)?(?:kurang\s+(?:sertifikat\s+pelatihan|sertifikat|berkas|dokumen|persyaratan|lengkap)|sertifikat\s+pelatihan|belum\s+lengkap|belum\s+terverifikasi|belum\s+diverifikasi)\s*$/i;

function cleanStatusSuffixes(raw: string): string {
  return raw.replace(STATUS_SUFFIX_RE, "").trim();
}

/**
 * Explains why no assessee candidate name could be inferred from a Drive path,
 * so triage can show a transparent reason per file instead of a blank roster.
 */
export function explainNameInference(drivePath: string | null | undefined): string | null {
  if (!drivePath) return null;
  const segments = drivePath.split("/").map((s) => s.trim()).filter(Boolean);
  if (segments.length <= 1) {
    return "Jalur Drive tidak memuat folder induk — tidak ada konteks nama yang dapat diinferensi.";
  }
  const folders = segments.slice(0, -1);
  const immediateParent = folders[folders.length - 1] ?? "";

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i] ?? "";
    if (/persyaratan|asesi|peserta|kandidat/i.test(folder)) {
      const next = folders[i + 1];
      if (!next) {
        return "Folder otoritatif (Persyaratan/Asesi/Peserta/Kandidat) kosong — tidak ada nama di dalamnya.";
      }
      if (isNonCandidateFolder(next)) {
        return `Entri di bawah folder otoritatif ("${next}" ) terdeteksi sebagai folder struktural, bukan nama orang.`;
      }
      const cleaned = cleanCandidateLabel(next);
      if (!isUsefulCandidateLabel(cleaned)) {
        return `Entri di bawah folder otoritatif ("${next}" ) tidak merupakan nama orang yang valid.`;
      }
      return null; // candidate found
    }
    if (/tugas\s*dit/i.test(folder)) {
      const next = folders[i + 1];
      if (!next) {
        return "Folder Tugas DIT kosong — tidak ada nama asesi yang dapat diinferensi.";
      }
      const cleaned = cleanCandidateLabel(next);
      if (!isUsefulCandidateLabel(cleaned)) {
        return `Entri di bawah Tugas DIT ("${next}" ) bukan nama orang (mungkin judul tugas atau kelompok).`;
      }
      return null; // candidate found
    }
  }

  if (
    immediateParent &&
    !isNonCandidateFolder(immediateParent) &&
    !hasTaskOrFolderPrefix(immediateParent)
  ) {
    const cleaned = cleanCandidateLabel(immediateParent);
    if (isUsefulCandidateLabel(cleaned)) {
      return null; // candidate found
    }
    return `Folder induk ("${immediateParent}" ) tidak menghasilkan nama orang yang valid.`;
  }

  if (immediateParent) {
    return `Folder induk ("${immediateParent}" ) dianggap struktural dan diabaikan — nama asesi tidak terdeteksi dari jalur Drive.`;
  }

  return "Tidak ada folder induk yang dapat dijadikan sumber nama asesi.";
}

/**
 * Returns true when an assessee display name still carries a raw folder/task prefix
 * (e.g. `TUGAS SUANGI`, `DIT LUMIKA`, `Kelompok 1`) rather than a clean person name.
 */
export function hasTaskOrFolderPrefix(raw: string): boolean {
  const normalized = raw.trim().replace(/[_-]+/g, " ");
  if (!normalized) return false;
  return TASK_OR_FOLDER_NAME_PREFIX_RE.test(normalized);
}

function isNonCandidateFolder(raw: string): boolean {
  const cleaned = cleanStatusSuffixes(raw);
  const lower = cleaned.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!lower) return true;
  // Exact/start-anchored structural folder names (e.g. "Materi", "Persyaratan", "Tugas DIT").
  if (EXTRA_NON_CANDIDATE_FOLDER_RE.test(lower)) return true;
  // Shared single-token folders (e.g. "umum", "lsp", "draft").
  if (SHARED_NON_CANDIDATE_TOKEN_SET.has(lower)) return true;
  // Contains-structural: only reject when the ENTIRE cleaned name is structural,
  // i.e. removing structural tokens leaves nothing person-like. A person folder
  // with a status suffix ("Budi - Kurang Sertifikat Pelatihan") is NOT structural.
  if (STRUCTURAL_FOLDER_CONTAINS_RE.test(lower)) {
    const rest = lower.replace(STRUCTURAL_FOLDER_CONTAINS_RE, " ").replace(/\s+/g, " ").trim();
    if (!rest || rest.length < 2) return true;
    return false;
  }
  return false;
}

export interface CandidateInference {
  candidateName: string | null;
  isAuthoritativeRoster: boolean;
}

export function cleanCandidateLabel(raw: string): string {
  return stripKnownFileExtensions(raw)
    .replace(/^\d+[\s._-]+/, "")
    .replace(/[_]+/g, " ")
    .replace(/^(?:tugas\s*presentasi\s*dit|tugas\s*dit|tugas\s*\d+|tugas|dit|presentasi)(?:$|\s+)/i, "")
    .replace(/^[\s._-]+/, "")
    .replace(/\(\d+\)$/g, "")
    .replace(/(?:\s+|[-._]+)(?:v\d+|rev\s*\d*|final|k3|ak3u|bnsp)$/i, "")
    .replace(STATUS_SUFFIX_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulCandidateLabel(cleaned: string): boolean {
  if (cleaned.length < 2) return false;
  if (isNonCandidateFolder(cleaned)) return false;
  if (/^\d+$/.test(cleaned)) return false;
  return true;
}

/**
 * Infers an assessee's display name and whether the source folder is an authoritative
 * BNSP registration/roster directory (e.g. `Persyaratan/`) vs a task submission folder
 * (`Tugas DIT/`) or underscore-prefixed artifact (`DIT_Faradhila A.Manaf.ppt`).
 */
export function inferCandidateFromDrivePath(
  drivePath: string,
  fileName: string,
): CandidateInference {
  const segments = drivePath.split("/").map((s) => s.trim()).filter(Boolean);
  if (segments.length <= 1) {
    return { candidateName: null, isAuthoritativeRoster: false };
  }

  // Parent folders excluding the filename itself
  const folders = segments.slice(0, -1);

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i] ?? "";
    if (/persyaratan|asesi|peserta|kandidat/i.test(folder)) {
      const next = folders[i + 1];
      if (next && !isNonCandidateFolder(next)) {
        const cleaned = cleanCandidateLabel(next);
        if (isUsefulCandidateLabel(cleaned)) {
          return { candidateName: cleaned, isAuthoritativeRoster: true };
        }
      }
      return { candidateName: null, isAuthoritativeRoster: false };
    }

    if (/tugas\s*dit/i.test(folder)) {
      const next = folders[i + 1];
      if (next) {
        // Strip leading task prefixes (e.g. "TUGAS DIT WIWI" -> "WIWI", "TUGAS SUANGI" -> "SUANGI")
        // before validating whether the remaining label is a usable person name rather than a folder title.
        const cleaned = cleanCandidateLabel(next);
        if (isUsefulCandidateLabel(cleaned)) {
          return { candidateName: cleaned, isAuthoritativeRoster: false };
        }
      }
      if (/\.(pptx|ppt|pdf|docx|doc|zip)$/i.test(fileName)) {
        const base = stripKnownFileExtensions(fileName);
        if (/^(?:tugas|dit)(?:$|[\s._-])/i.test(base)) {
          const withoutPart = base.split(/\s+-\s+pt\b/i)[0] ?? base;
          const cleaned = cleanCandidateLabel(withoutPart);
          if (isUsefulCandidateLabel(cleaned)) {
            return { candidateName: cleaned, isAuthoritativeRoster: false };
          }
        }
      }
      // Never fall through to raw parent folder names for Tugas DIT files
      return { candidateName: null, isAuthoritativeRoster: false };
    }
  }

  // Fallback: direct parent folder ONLY when it is not structural/task-prefixed
  const immediateParent = folders[folders.length - 1] ?? "";
  if (
    immediateParent &&
    !isNonCandidateFolder(immediateParent) &&
    !hasTaskOrFolderPrefix(immediateParent)
  ) {
    const cleaned = cleanCandidateLabel(immediateParent);
    if (isUsefulCandidateLabel(cleaned)) {
      return { candidateName: cleaned, isAuthoritativeRoster: false };
    }
  }

  return { candidateName: null, isAuthoritativeRoster: false };
}

/**
 * Infers an assessee's display name from a Drive file path or DIT filename.
 * Handles common BNSP folder patterns such as:
 * - `Persyaratan Pelatihan AK3 umum BNSP/1. Susilo Heni S. S.K.M/KTP Heni.jpg`
 * - `Pelatihan .../Tugas DIT/11. LINTANG SEPTYANJANI/...`
 * - `Pelatihan .../Tugas DIT/TUGAS PRESENTASI DIT Dina Oktavia Anggriani.pptx`
 * - `Pelatihan .../Tugas DIT/DIT_Faradhila A.Manaf.ppt`
 */
export function inferCandidateNameFromDrivePath(
  drivePath: string,
  fileName: string,
): string | null {
  return inferCandidateFromDrivePath(drivePath, fileName).candidateName;
}

/**
 * Parses single-cell newline-separated assessee lists from "Kelompok Asesi" CSV exports.
 */
export function parseKelompokAsesiCsv(csvText: string): Array<{
  groupName: string;
  assesseeNames: string[];
}> {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const groups: Array<{ groupName: string; assesseeNames: string[] }> = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row) continue;
    const cols = row.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    const groupName = cols[0] ?? `Kelompok ${i}`;
    const rawNames = cols[1] ?? "";
    const assesseeNames = rawNames
      .split(/\n|;/)
      .map((n) => n.trim())
      .filter((n) => n.length > 1);
    if (assesseeNames.length > 0) {
      groups.push({ groupName, assesseeNames });
    }
  }

  return groups;
}
