import { findBestMatchingCandidate } from "@/lib/names";
import { extractCandidateNamesFromDocumentText } from "@/services/drive";

export interface ParsedSuratTugasResult {
  assessmentDate: string | null;
  tukName: string | null;
  assessorName: string | null;
  letterNumber: string | null;
  candidateNames: string[];
}

export interface SuratTugasRosterSummary {
  detected: string[];
  alreadyInRoster: string[];
  toAdd: string[];
}

export function diffSuratTugasCandidates(
  detectedNames: string[],
  existingPool: Array<{ id?: string; displayName: string }>,
): SuratTugasRosterSummary {
  const alreadyInRoster: string[] = [];
  const toAdd: string[] = [];
  const existingNormalized = new Set(
    existingPool.map((a) => a.displayName.replace(/\s+/g, " ").trim().toLowerCase()),
  );

  for (const name of detectedNames) {
    const clean = name.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    const isExactMatch = existingNormalized.has(clean.toLowerCase());
    const isFuzzyMatch =
      !isExactMatch &&
      Boolean(
        findBestMatchingCandidate(
          clean,
          existingPool.map((a, idx) => ({
            id: a.id ?? String(idx),
            displayName: a.displayName,
          })),
        ),
      );
    if (isExactMatch || isFuzzyMatch) {
      alreadyInRoster.push(clean);
    } else {
      toAdd.push(clean);
    }
  }

  return {
    detected: [...alreadyInRoster, ...toAdd],
    alreadyInRoster,
    toAdd,
  };
}

const INDONESIAN_MONTHS: Record<string, number> = {
  januari: 1,
  jan: 1,
  january: 1,
  februari: 2,
  pebruari: 2,
  feb: 2,
  february: 2,
  maret: 3,
  mar: 3,
  march: 3,
  april: 4,
  apr: 4,
  mei: 5,
  may: 5,
  juni: 6,
  jun: 6,
  june: 6,
  juli: 7,
  jul: 7,
  july: 7,
  agustus: 8,
  agu: 8,
  ags: 8,
  agt: 8,
  aug: 8,
  august: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  oct: 10,
  october: 10,
  november: 11,
  nopember: 11,
  nov: 11,
  nop: 11,
  desember: 12,
  des: 12,
  dec: 12,
  december: 12,
};

const PARTICIPANT_HEADER_RE =
  /\b(?:daftar\s+(?:asesi|peserta(?:\s*uji)?|kandidat)|peserta\s+uji\s+kompetensi|nama\s*(?:asesi|peserta))\b/i;

function formatValidIsoDate(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function extractIsoDateFromText(snippet: string): string | null {
  if (!snippet) return null;

  // 1. YYYY-MM-DD
  const isoMatch = snippet.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const formatted = formatValidIsoDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    );
    if (formatted) return formatted;
  }

  const monthNamesPattern = Object.keys(INDONESIAN_MONTHS).join("|");

  // 2a. Indonesian date ranges like "18 - 19 November 2026" or "18 s.d. 19 November 2026"
  const rangeMatch = snippet.match(
    new RegExp(
      `\\b(0?[1-9]|[12]\\d|3[01])\\s*(?:-|–|—|s\\.?d\\.?|s\\/d|sampai(?:\\s+dengan)?|hingga|&|dan|,)\\s*(?:0?[1-9]|[12]\\d|3[01])\\s+(${monthNamesPattern})\\.?\\s+(20\\d{2})\\b`,
      "i",
    ),
  );
  if (rangeMatch) {
    const day = Number(rangeMatch[1]);
    const monthKey = (rangeMatch[2] ?? "").toLowerCase();
    const year = Number(rangeMatch[3]);
    const month = INDONESIAN_MONTHS[monthKey];
    if (month) {
      const formatted = formatValidIsoDate(year, month, day);
      if (formatted) return formatted;
    }
  }

  // 2b. DD Bulan YYYY (Indonesian / English month names)
  const namedMatch = snippet.match(
    new RegExp(`\\b(0?[1-9]|[12]\\d|3[01])\\s+(${monthNamesPattern})\\.?\\s+(20\\d{2})\\b`, "i"),
  );
  if (namedMatch) {
    const day = Number(namedMatch[1]);
    const monthKey = (namedMatch[2] ?? "").toLowerCase();
    const year = Number(namedMatch[3]);
    const month = INDONESIAN_MONTHS[monthKey];
    if (month) {
      const formatted = formatValidIsoDate(year, month, day);
      if (formatted) return formatted;
    }
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = snippet.match(/\b(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])[/-](20\d{2})\b/);
  if (dmyMatch) {
    const formatted = formatValidIsoDate(
      Number(dmyMatch[3]),
      Number(dmyMatch[2]),
      Number(dmyMatch[1]),
    );
    if (formatted) return formatted;
  }

  return null;
}

function cleanParsedField(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned || /^[-—_:]+$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Collapses PDF spacing artifacts inside document reference numbers (e.g.
 * "045 / ST - LSP / X I / 20 26" -> "045/ST-LSP/XI/2026").
 */
export function normalizeLetterNumber(raw: string): string | null {
  let s = raw
    .split(
      /\s+(?:perihal|hal|lampiran|tanggal|tgl\.?|sifat|kepada|menimbang|dasar|dengan\s+ini|yang\s+bertanda|skema|tuk|tempat|hari)\s*[:\-]/i,
    )[0]
    ?.split(/\r?\n/)[0] ?? "";

  s = s
    .replace(/\s+/g, " ")
    .replace(/\s*([/_-])\s*/g, "$1")
    .replace(/(?<=[A-Za-z0-9])\s*\.\s*(?=[A-Za-z0-9])/g, ".")
    .replace(/(?<=\d)\s+(?=\d)/g, "")
    .replace(/(?<=(?:^|[/_-])[A-Z])\s+(?=[A-Z](?:$|[/_-]))/g, "")
    .replace(/(?<=[/_-][A-Z]{1,4})\s+(?=[A-Z]{1,4}(?:$|[/_-]))/g, "")
    .replace(/\s+/g, " ")
    .replace(/[,;:\-/.\s]+$/, "")
    .trim();

  if (!s || s.length < 4 || !/[\d/]/.test(s)) return null;
  if (/^(?:reg|hp|ktp|nik|nip|met|telp)\b/i.test(s)) return null;
  return s;
}

function extractLetterNumber(headerText: string): string | null {
  const labeledPatterns = [
    /(?:nomor\s*(?:surat(?:\s*tugas)?|st)?|no\.?\s*surat(?:\s*tugas)?|\bn\s*o\s*m\s*o\s*r)\s*[:\-]\s*([^\n]{3,110})/gi,
    /^\s*(?:nomor|no\.?)\s*[:\-]?\s*([^\n]{4,110})/gim,
  ];
  for (const re of labeledPatterns) {
    for (const match of headerText.matchAll(re)) {
      const prefix = match[0].toLowerCase();
      if (/\bno\.?\s*(?:reg|hp|ktp|nik|nip|met|telp|urut|peserta)\b/.test(prefix)) {
        continue;
      }
      const normalized = normalizeLetterNumber(match[1] ?? "");
      if (normalized) return normalized;
    }
  }
  return null;
}

/**
 * Strips trailing subsequent-field labels and redundant room/floor qualifiers from TUK names.
 */
export function cleanTukName(raw: string): string | null {
  let s = raw
    .split(
      /\s+(?:hari\s*[/,]?\s*tanggal|tanggal|tgl\.?|waktu|pukul|jam|skema|alamat|asesor|peserta|daftar|keterangan|catatan|metode|jenis\s*tuk)\s*[:\-]/i,
    )[0]
    ?.split(/\r?\n/)[0] ?? "";

  s = s.replace(/\s+/g, " ").trim();
  if (!s) return null;

  // Remove parenthetical room/floor details like "(Ruang Meeting A)" or "(Lantai 3 Ruang 302)"
  s = s.replace(
    /\s*\([^)]*\b(?:ruang(?:an)?|room|kelas|aula|lab(?:oratorium)?|lantai|lt\.?|gedung|meeting|zoom|breakout|workshop|bengkel)\b[^)]*\)/gi,
    "",
  );

  // Remove delimited or trailing room/floor mentions while preserving TUK prefix (>=3 chars)
  const roomTailRe =
    /^(.{3,}?)\s*(?:[,/\-–—|]\s*|\s+(?:di\s+)?)(?:ruang(?:an)?|room|meeting\s*room|breakout\s*room|kelas|aula|lantai|lt\.?)\b.*$/i;
  const roomMatch = s.match(roomTailRe);
  if (roomMatch?.[1]) {
    s = roomMatch[1];
  }

  s = s.replace(/[\s,;:\-/]+$/, "").replace(/\s+/g, " ").trim();
  if (!s || s.length < 3 || /^[-—_]+$/.test(s)) return null;
  if (/^(sewaktu|tempat\s*kerja|mandiri)$/i.test(s)) return null;
  return s;
}

function extractTukName(searchText: string): string | null {
  const tukPatterns = [
    /(?:tempat\s*uji\s*kompetensi(?:\s*\(tuk\))?|nama\s*tuk)\s*(?:[:\-]|\n\s*[:\-]?)\s*([^\n;]{3,180})/gi,
    /\btuk\s*(?:[:\-]|\n\s*[:\-])\s*([^\n;]{3,180})/gi,
    /(?:tempat\s*pelaksanaan|lokasi\s*(?:uji|asesmen))\s*(?:[:\-]|\n\s*[:\-]?)\s*([^\n;]{3,180})/gi,
  ];
  for (const re of tukPatterns) {
    for (const match of searchText.matchAll(re)) {
      const cleaned = cleanTukName(match[1] ?? "");
      if (cleaned) return cleaned;
    }
  }
  return null;
}

function cleanAssessorName(raw: string | undefined): string | null {
  if (!raw) return null;
  const stripped = raw
    .split(
      /\b(?:met\.?\s*[.:]?\s*\d|no\.?\s*reg|nra\.?\s*[:\-]|nip\.?\s*[:\-]|nik\.?\s*[:\-]|jabatan|skema|tuk|tempat|tanggal|hari|waktu|alamat|untuk\b|sebagai\b)/i,
    )[0]
    ?.replace(/^\s*(?:kepada|yth\.?|saudara|sdri\.?|sdr\.?|bapak|ibu)\s+/i, "")
    .replace(/[\s,/(;:\-]+$/, "")
    .trim();

  const cleaned = cleanParsedField(stripped);
  if (!cleaned || cleaned.length < 3 || cleaned.length > 90) return null;
  if (
    /^(?:sebagai\s+berikut|yang\s+ditugaskan|tersebut|asesor|nama|daftar|met|tuk|tanggal)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  if (/^\d+$/.test(cleaned) || !/[A-Za-z]{2}/.test(cleaned)) return null;
  return cleaned;
}

function extractAssessorName(headerText: string): string | null {
  // 1. Direct labeled Assessor line (same line or wrapped line after colon)
  const directPatterns = [
    /(?:nama\s*asesor(?:\s*(?:kompetensi|penguji))?|asesor\s*(?:kompetensi|penguji)|asesor\s*yang\s*ditugaskan|\basesor)\s*[:\-]\s*\n?\s*([^\n;]{3,120})/gi,
    /^\s*(?:nama\s*asesor|asesor\s*kompetensi|asesor\s*penguji)\s*\n\s*[:\-]?\s*([^\n;]{3,120})/gim,
  ];
  for (const re of directPatterns) {
    for (const match of headerText.matchAll(re)) {
      const candidate = cleanAssessorName(match[1]);
      if (candidate) return candidate;
    }
  }

  // 2. Assignment block ("Menugaskan kepada" / "Memberi tugas kepada" / "Menunjuk")
  const assignMatch = headerText.match(
    /(?:menugaskan(?:\s*kepada)?|memberikan?\s*tugas(?:\s*kepada)?|ditugaskan\s*kepada|menunjuk)\s*[:\-]?([\s\S]{1,500})/i,
  );
  if (assignMatch?.[1]) {
    const windowText = assignMatch[1];
    const namaLineMatch = windowText.match(
      /\bnama(?:\s*(?:lengkap|asesor))?\s*[:\-]\s*\n?\s*([^\n;]{3,120})/i,
    );
    const fromNama = cleanAssessorName(namaLineMatch?.[1]);
    if (fromNama) return fromNama;

    const numberedAssign = windowText.match(
      /^\s*\d+[.)]?\s+([A-Za-z][A-Za-z\t .,'()-]{2,80})/m,
    );
    const fromNum = cleanAssessorName(numberedAssign?.[1]);
    if (fromNum) return fromNum;
  }

  // 3. MET / No. Reg anchor in headerText
  const lines = headerText.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (!/\b(?:met\.?\s*[.:]?\s*\d|no\.?\s*reg(?:\s*asesor|\s*met)?\s*[:\-]?\s*[A-Z0-9])/i.test(line)) {
      continue;
    }
    const beforeMet = line
      .split(/\b(?:met\.?\s*[.:]?\s*\d|no\.?\s*reg)/i)[0]
      ?.replace(/^\s*(?:\d+[.)]?\s*)?(?:nama(?:\s*asesor)?\s*[:\-]\s*)?/i, "");
    const sameLineCandidate = cleanAssessorName(beforeMet);
    if (sameLineCandidate) return sameLineCandidate;

    for (let back = 1; back <= 2; back += 1) {
      const prevLine = (lines[i - back] ?? "")
        .replace(/^\s*(?:\d+[.)]?\s*)?(?:nama(?:\s*asesor|\s*lengkap)?\s*[:\-]\s*)?/i, "");
      const prevCandidate = cleanAssessorName(prevLine);
      if (prevCandidate) return prevCandidate;
    }
  }

  return null;
}

const NOISE_PARTICIPANT_RE =
  /^(?:nama(?:\s*(?:peserta|asesi|lengkap))?|peserta|asesi|asesor|skema|instansi|perusahaan|jabatan|tuk|tanggal|nomor|no\.?|keterangan|tanda\s*tangan|mengetahui|direktur|ketua|lampiran)\b/i;

function sanitizeCandidateLine(raw: string): string | null {
  const cleaned = raw
    .split(/\s*[|\t]\s*|\s{2,}/)[0]
    ?.split(
      /\s+(?:nik|no\.?\s*ktp|nip|telp|no\.?\s*hp|hp|email|e-mail|instansi|perusahaan|jabatan|tuk|lsp|skema)\s*[:\-]/i,
    )[0]
    ?.replace(/\b08\d{7,}\b.*$/, "")
    .replace(/\b\d{12,}\b.*$/, "")
    .replace(/[\s,;:.\-/]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 3) return null;
  if (NOISE_PARTICIPANT_RE.test(cleaned)) return null;
  if (!/[A-Za-z]{2}/.test(cleaned)) return null;
  return cleaned;
}

function extractParticipantsFromSuratTugas(normalizedText: string): string[] {
  const canonicalNames = extractCandidateNamesFromDocumentText("surat_tugas", normalizedText);
  const collected: string[] = [];

  const headerIdx = normalizedText.search(PARTICIPANT_HEADER_RE);
  if (headerIdx >= 0) {
    const tail = normalizedText.slice(headerIdx);
    // Split inline flattened list items onto separate lines: "1. Budi 2. Ani" -> "1. Budi\n2. Ani"
    const linePrepared = tail
      .replace(/([^\n])\s+(?=\d{1,2}[.)]\s+[A-Za-z])/g, "$1\n")
      .replace(/([^\n])\s+(?=\d{1,2}\s*[|\t]\s*[A-Za-z])/g, "$1\n");

    const lines = linePrepared.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";

      // Form A: "1. Name", "1) Name", "1 | Name | ...", "1\tName"
      const numberedMatch = line.match(
        /^\s*\d{1,2}\s*(?:[.)]|[|\t])\s*(?:\|\s*)?([A-Za-z][A-Za-z\t .,'()|/\-]{2,110})/,
      );
      if (numberedMatch?.[1]) {
        const cleaned = sanitizeCandidateLine(numberedMatch[1]);
        if (cleaned) collected.push(cleaned);
        continue;
      }

      // Form B: DOCX cell-per-line table where index "1" sits alone on one line and name sits on next line
      if (/^\s*\d{1,2}[.)]?\s*$/.test(line) && i + 1 < lines.length) {
        const nextLine = (lines[i + 1] ?? "").trim();
        if (/^[A-Za-z][A-Za-z\t .,'()-]{2,80}$/.test(nextLine)) {
          const cleaned = sanitizeCandidateLine(nextLine);
          if (cleaned) {
            collected.push(cleaned);
            i += 1;
          }
        }
      }
    }
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const name of [...canonicalNames, ...collected]) {
    const norm = name.replace(/\s+/g, " ").trim();
    if (!norm || NOISE_PARTICIPANT_RE.test(norm)) continue;
    const key = norm.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(norm);
    }
  }
  return deduped;
}

/**
 * Extracts structured metadata (assessment date, TUK name, letter number, assessor name,
 * and candidate list) from extracted text of an optional BNSP Surat Tugas document.
 */
export function parseSuratTugasText(text: string): ParsedSuratTugasResult {
  const normalized = text.replace(/\r\n?/g, "\n");
  const splitIdx = normalized.search(PARTICIPANT_HEADER_RE);
  const headerSection = splitIdx > 0 ? normalized.slice(0, splitIdx) : normalized;

  // Assessment Date priority: explicit schedule/assessment lines -> general Tanggal -> standalone non-TTL date
  let assessmentDate: string | null = null;
  const priorityDatePatterns = [
    /(?:tanggal\s*(?:asesmen|pelaksanaan|uji(?:\s*kompetensi)?|kegiatan)|hari\s*[/,]?\s*tanggal|waktu\s*pelaksanaan|dilaksanakan\s*(?:pada(?:\s*tanggal)?|tanggal))\s*[:\-]?\s*([^\n]{5,100})/gi,
    /\btanggal\s*[:\-]\s*([^\n]{5,80})/gi,
  ];
  for (const re of priorityDatePatterns) {
    for (const match of headerSection.matchAll(re)) {
      const candidate = extractIsoDateFromText(match[1] ?? "");
      if (candidate) {
        assessmentDate = candidate;
        break;
      }
    }
    if (assessmentDate) break;
  }
  if (!assessmentDate) {
    for (const line of headerSection.split("\n")) {
      if (/\b(?:tempat\/?\s*(?:tanggal|tgl)\.?\s*lahir|ttl)\b/i.test(line)) continue;
      const found = extractIsoDateFromText(line);
      if (found) {
        assessmentDate = found;
        break;
      }
    }
  }

  const tukName = extractTukName(headerSection) ?? extractTukName(normalized);
  const letterNumber = extractLetterNumber(headerSection);
  const assessorName = extractAssessorName(headerSection);
  const candidateNames = extractParticipantsFromSuratTugas(normalized);

  return {
    assessmentDate,
    tukName,
    assessorName,
    letterNumber,
    candidateNames,
  };
}
