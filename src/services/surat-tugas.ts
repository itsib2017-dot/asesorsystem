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

const DAFTAR_PESERTA_RE =
  /\bdaftar\s+(?:asesi|peserta(?:\s*uji(?:\s*kompetensi)?)?|kandidat)\b/gi;
const PESERTA_UJI_RE = /\bpeserta\s+uji\s+kompetensi\b/gi;

function isInsideLampiranLabel(text: string, idx: number): boolean {
  const lineStart = text.lastIndexOf("\n", Math.max(0, idx - 1)) + 1;
  return /\blampiran\s*[:\-]\s*$/i.test(text.slice(lineStart, idx));
}

function findParticipantSectionIndex(text: string): number {
  const daftarMatches = Array.from(text.matchAll(DAFTAR_PESERTA_RE));
  const realDaftar = daftarMatches.filter((m) => m.index !== undefined && !isInsideLampiranLabel(text, m.index));
  if (realDaftar.length > 0) {
    return realDaftar.at(-1)?.index ?? -1;
  }

  const pesertaMatches = Array.from(text.matchAll(PESERTA_UJI_RE));
  const realPeserta = pesertaMatches.filter((m) => m.index !== undefined && !isInsideLampiranLabel(text, m.index));
  if (realPeserta.length > 0) {
    return realPeserta.at(-1)?.index ?? -1;
  }

  if (daftarMatches.length > 0) {
    return daftarMatches.at(-1)?.index ?? -1;
  }

  for (const m of text.matchAll(/(?:^|\n)\s*nama\s*(?:asesi|peserta)\b/gi)) {
    if (m.index === undefined) continue;
    const after = text.slice(m.index, m.index + 160);
    if (/\b(?:terlampir|met\.?\s*\d|no\.?\s*reg)\b/i.test(after)) continue;
    return m.index;
  }

  return -1;
}

function preprocessSuratTugasText(rawText: string): { repairedLines: string; flatText: string } {
  // Repair fragmented PDF tokens where a leading uppercase letter was split onto its own line ("P\nukul" -> "Pukul", "S\nuhartono" -> "Suhartono")
  const repairedLines = rawText
    .replace(/\r\n?/g, "\n")
    .replace(/(^|\n)([A-Z])\n([a-z]{2,})/g, "$1$2$3");
  const flatText = repairedLines.replace(/\s+/g, " ").trim();
  return { repairedLines, flatText };
}

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
 * "3 801 / ST/LSP - K3N/ X I /20 2 6" -> "3801/ST/LSP-K3N/XI/2026").
 */
export function normalizeLetterNumber(raw: string): string | null {
  let s =
    raw
      .split(
        /\s+(?:(?:perihal|hal|lampiran|tanggal|tgl\.?|sifat|kepada|dasar|menimbang|sehubungan|dengan\s+ini|yang\s+bertanda|daftar\s+(?:peserta|asesi)|skema|tuk|tempat|hari|untuk)\s*[:\-]|\b(?:dasar|sehubungan\s+dengan|menimbang|untuk)\b\s)/i,
      )[0]
      ?.split(/\r?\n/)[0] ?? "";

  s = s
    .replace(/\s+/g, " ")
    .replace(/\s*([/_-])\s*/g, "$1")
    .replace(/(?<=[A-Za-z0-9])\s*\.\s*(?=[A-Za-z0-9])/g, ".")
    .replace(/(?<=\d)\s+(?=\d)/g, "")
    .replace(/(?<=(?:^|[/_-])[A-Z])\s+(?=[A-Z](?:$|[/_-]))/g, "")
    .replace(/(?<=(?:^|[/_-])[A-Z]{1,2})\s+(?=[A-Z](?:$|[/_-]))/g, "")
    .replace(/(?<=[/_-][A-Z]{1,4})\s+(?=[A-Z]{1,4}(?:$|[/_-]))/g, "")
    .replace(/\s+/g, " ")
    .replace(/[,;:\-/.\s]+$/, "")
    .trim();

  if (!s || s.length < 4 || !/[\d/]/.test(s)) return null;
  if (/^(?:reg|hp|ktp|nik|nip|met|telp)\b/i.test(s)) return null;
  return s;
}

function extractLetterNumber(repairedLines: string, flatText: string): string | null {
  const sources = [repairedLines, flatText];
  const labeledPatterns = [
    /(?:nomor\s*(?:surat(?:\s*tugas)?|st)?|no\.?\s*surat(?:\s*tugas)?|\bn\s*o\s*m\s*o\s*r)\s*[:\-]\s*([^\n]{3,140})/gi,
    /^\s*(?:nomor|no\.?)\s*[:\-]?\s*([^\n]{4,140})/gim,
  ];
  for (const src of sources) {
    for (const re of labeledPatterns) {
      for (const match of src.matchAll(re)) {
        const prefix = match[0].toLowerCase();
        if (/\bno\.?\s*(?:reg|hp|ktp|nik|nip|met|telp|urut|peserta)\b/.test(prefix)) {
          continue;
        }
        const normalized = normalizeLetterNumber(match[1] ?? "");
        if (normalized) return normalized;
      }
    }
  }
  return null;
}

/**
 * Strips trailing subsequent-field labels and redundant room/floor qualifiers from TUK names.
 */
export function cleanTukName(raw: string): string | null {
  let s =
    raw
      .split(
        /\s+(?:nama\s*ruang(?:an)?|ruang(?:an)?|hari\s*[/,]?\s*tanggal|tanggal(?:\s*(?:asesmen|pelaksanaan|uji(?:\s*kompetensi)?))?|tgl\.?|waktu|pukul|jam|skema|alamat|asesor|peserta|daftar|keterangan|catatan|metode|jenis\s*tuk|lampiran|no\.?\s*surat|dasar|untuk)\s*[:\-]/i,
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
  if (/^(?:tuk|sewaktu|tempat\s*kerja|mandiri)$/i.test(s)) return null;
  return s;
}

function collectTukMatches(searchText: string): string[] {
  const candidates: string[] = [];
  const tukPatterns = [
    /(?:tempat\s*uji\s*kompetensi(?:\s*\(tuk\))?|nama\s*tuk)\s*(?:[:\-]|\n\s*[:\-]?)\s*([^\n;]{3,180})/gi,
    /\btuk\s*(?:[:\-]|\n\s*[:\-])\s*([^\n;]{3,180})/gi,
    /(?:tempat\s*pelaksanaan|lokasi\s*(?:uji|asesmen))\s*(?:[:\-]|\n\s*[:\-]?)\s*([^\n;]{3,180})/gi,
  ];
  for (const re of tukPatterns) {
    for (const match of searchText.matchAll(re)) {
      const cleaned = cleanTukName(match[1] ?? "");
      if (cleaned) candidates.push(cleaned);
    }
  }
  return candidates;
}

function extractTukName(repairedLines: string, flatText: string): string | null {
  const lineCandidates = collectTukMatches(repairedLines);
  const flatCandidates = collectTukMatches(flatText);

  const linePref = lineCandidates.find((c) => /^tuk\b/i.test(c) && c.length >= 12);
  if (linePref) return linePref;

  const flatPref = flatCandidates.find((c) => /^tuk\b/i.test(c));
  if (flatPref) return flatPref;

  return lineCandidates[0] ?? flatCandidates[0] ?? null;
}

function extractAssessmentDate(repairedLines: string, flatText: string): string | null {
  const priorityDatePatterns = [
    /(?:tanggal\s*(?:asesmen|pelaksanaan|uji(?:\s*kompetensi)?|kegiatan)|hari\s*[/,]?\s*tanggal|waktu\s*pelaksanaan|dilaksanakan\s*(?:pada(?:\s*tanggal)?|tanggal))\s*[:\-]?\s*([^\n]{5,75})/gi,
    /\btanggal\s*[:\-]\s*([^\n]{5,70})/gi,
  ];

  for (const src of [repairedLines, flatText]) {
    for (const re of priorityDatePatterns) {
      for (const match of src.matchAll(re)) {
        const prefix = src.slice(Math.max(0, (match.index ?? 0) - 25), match.index ?? 0);
        if (/\b(?:tempat\/?\s*|tgl\.?\s*lahir|lahir)\b/i.test(prefix)) continue;
        const candidate = extractIsoDateFromText(match[1] ?? "");
        if (candidate) return candidate;
      }
    }
  }

  let signatureDateFallback: string | null = null;
  for (const line of repairedLines.split("\n")) {
    if (/\b(?:tempat\/?\s*(?:tanggal|tgl)\.?\s*lahir|ttl)\b/i.test(line)) continue;
    const found = extractIsoDateFromText(line);
    if (!found) continue;
    if (/^[A-Za-z .]{2,30},\s*\d{1,2}\s+/.test(line.trim())) {
      signatureDateFallback ??= found;
      continue;
    }
    return found;
  }

  return signatureDateFallback;
}

function cleanAssessorName(raw: string | undefined): string | null {
  if (!raw) return null;
  const stripped = raw
    .split(
      /\b(?:met\.?\s*[.:]?\s*\d|no\.?\s*reg|nra\.?\s*[:\-]|nip\.?\s*[:\-]|nik\.?\s*[:\-]|jabatan|skema|tuk|tempat|tanggal|hari|waktu|alamat|untuk\b|sebagai\b|ahli\s+keselamatan)/i,
    )[0]
    ?.replace(/^\s*(?:kepada|yth\.?|saudara|sdri\.?|sdr\.?|bapak|ibu)\s+/i, "")
    .replace(/[\s,/(;:\-]+$/, "")
    .trim();

  const cleaned = cleanParsedField(stripped);
  if (!cleaned || cleaned.length < 3 || cleaned.length > 90) return null;
  if (
    /^(?:sebagai(?:\s+berikut)?|yang\s+ditugaskan|tersebut|asesor|nama|daftar|met|tuk|tanggal|terlampir|menjadi|mempersiapkan|melaksanakan|melaporkan|no\.?|pada|sesuai|dengan|kepada|dari|atau|dan|serta|yang|oleh|di|ke)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  if (/^\d+$/.test(cleaned) || !/[A-Za-z]{2}/.test(cleaned) || !/[A-Z]/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function extractAssessorName(scopeLines: string, scopeFlat: string): string | null {
  // 1. Direct labeled Assessor line (same line or wrapped line after colon)
  const directPatterns = [
    /(?:nama[ \t]+asesor(?:[ \t]+(?:kompetensi|penguji))?|asesor[ \t]+(?:kompetensi|penguji)|asesor[ \t]+yang[ \t]+ditugaskan|\basesor)[ \t]*[:\-]\s*\n?\s*([^\n;]{3,120})/gi,
    /^[ \t]*(?:nama[ \t]+asesor|asesor[ \t]+kompetensi|asesor[ \t]+penguji)[ \t]*\n[ \t]*[:\-]?[ \t]*([^\n;]{3,120})/gim,
  ];
  for (const re of directPatterns) {
    for (const match of scopeLines.matchAll(re)) {
      const candidate = cleanAssessorName(match[1]);
      if (candidate) return candidate;
    }
  }

  // 2. MET / No. Reg anchor (multiline lines + flat lookback before MET. <digits>)
  const lines = scopeLines.split("\n");
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
      const prevLine = (lines[i - back] ?? "").replace(
        /^\s*(?:\d+[.)]?\s*)?(?:nama(?:\s*(?:asesor|lengkap))?\s*[:\-]\s*)?/i,
        "",
      );
      const prevCandidate = cleanAssessorName(prevLine);
      if (prevCandidate) return prevCandidate;
    }
  }

  for (const m of scopeFlat.matchAll(/\b(?:met\.?\s*[.:]?\s*\d+|no\.?\s*reg\.?\s*met\b)/gi)) {
    const idx = m.index ?? 0;
    const lookback = scopeFlat.slice(Math.max(0, idx - 120), idx);
    const tail = lookback
      .split(/(?:\d{1,2}[.)]\s+|:\s*|;\s*|\b(?:nama\s*(?:asesi|asesor|lengkap)|no\.?\s*reg\.?)\b\s*[:\-]?)/i)
      .at(-1);
    const candidate = cleanAssessorName(tail);
    if (candidate) return candidate;
  }

  // 3. Assignment block ("Menugaskan kepada" / "Memberi tugas kepada" / "Menunjuk")
  const assignMatch = scopeLines.match(
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
      /^\s*\d+[.)]\s*\n?\s*([A-Za-z][A-Za-z\t .,'()-]{2,80})/m,
    );
    const fromNum = cleanAssessorName(numberedAssign?.[1]);
    if (fromNum) return fromNum;
  }

  return null;
}

const NOISE_PARTICIPANT_RE =
  /^(?:nama(?:\s*(?:peserta|asesi|lengkap|ruang))?|peserta|asesi|asesor|skema|instansi|perusahaan|organisasi|jabatan|tuk|tanggal|nomor|no\.?|keterangan|tanda\s*tangan|mengetahui|direktur|ketua|lampiran|alamat|pukul|waktu|dasar|untuk|uji|kompetensi|sewaktu|mandiri|terlampir|menjadi|mempersiapkan|melaksanakan|melaporkan|mengikuti|membuat|menyusun|menyerahkan|bertanggung|hadir|membawa|sesuai)\b/i;

function sanitizeCandidateLine(raw: string): string | null {
  const cleaned = raw
    .split(/\s*[|\t]\s*|\s{2,}/)[0]
    ?.split(
      /\s+(?:nik|no\.?\s*ktp|nip|telp|no\.?\s*hp|hp|email|e-mail|instansi|perusahaan|organisasi|jabatan|tuk|lsp|skema|met\.?\s*[.:]?\s*\d|no\.?\s*reg)\b/i,
    )[0]
    ?.replace(/\s+-\s*$/, "")
    .replace(/\b08\d{7,}\b.*$/, "")
    .replace(/\b\d{12,}\b.*$/, "")
    .replace(/[\s,;:.\-/]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 3 || cleaned.length > 75) return null;
  if (NOISE_PARTICIPANT_RE.test(cleaned)) return null;
  if (/\b(?:met\.?\s*\d|no\.?\s*reg)\b/i.test(cleaned)) return null;
  if (!/[A-Za-z]{2}/.test(cleaned)) return null;
  if (cleaned.split(/\s+/).length > 6) return null;
  if (/\.$/.test(raw.trim()) && cleaned.split(/\s+/).length >= 4) return null;
  return cleaned;
}

function extractParticipantsFromSuratTugas(repairedLines: string): string[] {
  const headerIdx = findParticipantSectionIndex(repairedLines);
  const collected: string[] = [];

  if (headerIdx >= 0) {
    const rawTail = repairedLines.slice(headerIdx);
    const footerIdx = rawTail.search(
      /^\s*(?:gowork|jl\.|jakarta\s*,|ditetapkan|mengetahui|ketua\b|tembusan|demikian\b)/im,
    );
    const tail = footerIdx > 0 ? rawTail.slice(0, footerIdx) : rawTail;

    // Repair split single-capital names inside flat table rows ("2 S uhartono -" -> "2 Suhartono -")
    // and insert line breaks before inline rows ("1. A 2. B" or "1 Aryanto - 2 Suhartono -")
    const flatAwareTail = tail
      .replace(/\b(\d{1,2})\s+([A-Z])\s+([a-z]{3,})\b/g, "$1 $2$3")
      .replace(/([^\n])\s+(?=\d{1,2}[.)]\s+[A-Za-z])/g, "$1\n")
      .replace(/([^\n])\s+(?=\d{1,2}\s*[|\t]\s*[A-Za-z])/g, "$1\n")
      .replace(/([^\n])\s+(?=\d{1,2}\s+[A-Za-z][A-Za-z\t .,'()-]{1,50}\s+-\s*(?:\n|$|\d))/g, "$1\n");

    const lines = flatAwareTail.split("\n");
    let expectedBareSeqIdx = 1;
    let sawBareHeader = /\bno\s+nama\b/i.test(flatAwareTail);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]?.trim() ?? "";
      if (!line) continue;

      if (/^(?:no|no\s+nama(?:\s+organisasi)?)$/i.test(line)) {
        sawBareHeader = true;
        continue;
      }

      // Form A1: explicit punctuated/delimited list ("1. Name", "1) Name", "1 | Name", "1\tName")
      const punctMatch = line.match(
        /^\s*(\d{1,2})\s*(?:[.)]|[|\t])\s*(?:\|\s*)?([A-Za-z][A-Za-z\t .,'()|/\-]{2,110})/,
      );
      if (punctMatch?.[2]) {
        const cleaned = sanitizeCandidateLine(punctMatch[2]);
        if (cleaned) {
          collected.push(cleaned);
          expectedBareSeqIdx = Number(punctMatch[1]) + 1;
        }
        continue;
      }

      // Form A2: space-separated table row ("1 Aryanto -", "2 Suhartono -")
      const spaceTableMatch = line.match(
        /^\s*(\d{1,2})\s+([A-Za-z][A-Za-z .,'()-]{2,70}?)(?:\s+-)?\s*$/,
      );
      if (spaceTableMatch?.[1] && spaceTableMatch[2]) {
        const rowIdx = Number(spaceTableMatch[1]);
        const looksLikeTableRow =
          /\s+-\s*$/.test(line) || (sawBareHeader && rowIdx === expectedBareSeqIdx);
        if (looksLikeTableRow && rowIdx >= 1 && rowIdx <= 99 && rowIdx === expectedBareSeqIdx) {
          const cleaned = sanitizeCandidateLine(spaceTableMatch[2]);
          if (cleaned) {
            collected.push(cleaned);
            expectedBareSeqIdx = rowIdx + 1;
            continue;
          }
        }
      }

      // Form B: DOCX/PDF cell-per-line table where index "1" / "1." sits alone on a line and name on next line
      const bareIdxMatch = line.match(/^(\d{1,2})([.)])?$/);
      if (bareIdxMatch?.[1] && i + 1 < lines.length) {
        const rowIdx = Number(bareIdxMatch[1]);
        const hasPunct = Boolean(bareIdxMatch[2]);
        const validSeq = hasPunct || (rowIdx === expectedBareSeqIdx && (sawBareHeader || rowIdx === 1));
        if (validSeq && rowIdx >= 1 && rowIdx <= 99) {
          const nextLine = (lines[i + 1] ?? "").trim();
          if (/^[A-Za-z][A-Za-z\t .,'()-]{2,80}$/.test(nextLine)) {
            const cleaned = sanitizeCandidateLine(nextLine);
            if (cleaned) {
              collected.push(cleaned);
              expectedBareSeqIdx = rowIdx + 1;
              i += 1;
            }
          }
        }
      }
    }
  }

  const canonicalNames =
    collected.length > 0 ? [] : extractCandidateNamesFromDocumentText("surat_tugas", repairedLines);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const name of [...collected, ...canonicalNames]) {
    const cleaned = sanitizeCandidateLine(name);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(cleaned);
    }
  }
  return deduped;
}

/**
 * Extracts structured metadata (assessment date, TUK name, letter number, assessor name,
 * and candidate list) from extracted text of an optional BNSP Surat Tugas document.
 */
export function parseSuratTugasText(text: string): ParsedSuratTugasResult {
  const { repairedLines, flatText } = preprocessSuratTugasText(text);
  const participantIdx = findParticipantSectionIndex(repairedLines);
  const assessorScopeLines =
    participantIdx > 0 ? repairedLines.slice(0, participantIdx) : repairedLines;
  const assessorScopeFlat = assessorScopeLines.replace(/\s+/g, " ").trim();

  return {
    assessmentDate: extractAssessmentDate(repairedLines, flatText),
    tukName: extractTukName(repairedLines, flatText),
    assessorName: extractAssessorName(assessorScopeLines, assessorScopeFlat),
    letterNumber: extractLetterNumber(repairedLines, flatText),
    candidateNames: extractParticipantsFromSuratTugas(repairedLines),
  };
}
