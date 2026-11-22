import { extractCandidateNamesFromDocumentText } from "@/services/drive";

export interface ParsedSuratTugasResult {
  assessmentDate: string | null;
  tukName: string | null;
  assessorName: string | null;
  letterNumber: string | null;
  candidateNames: string[];
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

  // 2. DD Bulan YYYY (Indonesian / English month names)
  const monthNamesPattern = Object.keys(INDONESIAN_MONTHS).join("|");
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
  if (!cleaned || /^[-—_]+$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Extracts structured metadata (assessment date, TUK name, letter number, assessor name,
 * and candidate list) from extracted text of an optional BNSP Surat Tugas document.
 */
export function parseSuratTugasText(text: string): ParsedSuratTugasResult {
  const normalized = text.replace(/\r\n?/g, "\n");

  // Assessment Date priority: explicit schedule/assessment lines -> general Tanggal -> standalone non-TTL date
  let assessmentDate: string | null = null;
  const priorityDatePatterns = [
    /(?:tanggal\s*(?:asesmen|pelaksanaan|uji(?:\s*kompetensi)?|kegiatan)|hari\s*[/,]?\s*tanggal|dilaksanakan\s*(?:pada|tanggal))\s*[:\-]?\s*([^\n]{5,90})/gi,
    /\btanggal\s*[:\-]\s*([^\n]{5,70})/gi,
  ];
  for (const re of priorityDatePatterns) {
    for (const match of normalized.matchAll(re)) {
      const candidate = extractIsoDateFromText(match[1] ?? "");
      if (candidate) {
        assessmentDate = candidate;
        break;
      }
    }
    if (assessmentDate) break;
  }
  if (!assessmentDate) {
    for (const line of normalized.split("\n")) {
      if (/\b(?:tempat\/?\s*(?:tanggal|tgl)\.?\s*lahir|ttl)\b/i.test(line)) continue;
      const found = extractIsoDateFromText(line);
      if (found) {
        assessmentDate = found;
        break;
      }
    }
  }

  // TUK Name
  let tukName: string | null = null;
  const tukPatterns = [
    /(?:tempat\s*uji\s*kompetensi(?:\s*\(tuk\))?|nama\s*tuk)\s*[:\-]\s*([^\n;]{3,160})/i,
    /\btuk\s*[:\-]\s*([^\n;]{3,160})/i,
    /(?:tempat\s*pelaksanaan|lokasi\s*(?:uji|asesmen))\s*[:\-]\s*([^\n;]{3,160})/i,
  ];
  for (const re of tukPatterns) {
    const match = normalized.match(re);
    const candidate = cleanParsedField(match?.[1]);
    if (candidate && !/^(sewaktu|tempat\s*kerja|mandiri)$/i.test(candidate)) {
      tukName = candidate;
      break;
    }
  }

  // Letter number
  const letterMatch = normalized.match(
    /(?:nomor\s*(?:surat(?:\s*tugas)?|st)?|no\.?\s*surat(?:\s*tugas)?)\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9./\- ]{3,79})/i,
  );
  const letterNumber = cleanParsedField(letterMatch?.[1]);

  // Assessor name
  let assessorName: string | null = null;
  const assessorMatch = normalized.match(
    /(?:nama\s*asesor|asesor\s*kompetensi|asesor\s*yang\s*ditugaskan|asesor)\s*[:\-]\s*([^\n;]{3,120})/i,
  );
  if (assessorMatch?.[1]) {
    const stripped = assessorMatch[1]
      .split(/\b(?:met\.?\s*\d|no\.?\s*reg)/i)[0]
      ?.replace(/[,/(]+$/, "");
    assessorName = cleanParsedField(stripped);
  }

  // Candidate list: always delegate first to drive.ts canonical extractor
  const baseNames = extractCandidateNamesFromDocumentText("surat_tugas", normalized);
  const extraNames: string[] = [];
  if (baseNames.length === 0) {
    const fallbackSection = normalized.split(
      /DAFTAR\s+(?:ASESI|PESERTA(?:\s*UJI)?|KANDIDAT)|PESERTA\s+UJI\s+KOMPETENSI|NAMA\s*(?:ASESI|PESERTA)/i,
    );
    if (fallbackSection.length > 1) {
      const tail = fallbackSection.slice(1).join("\n");
      for (const m of tail.matchAll(/^\s*\d+[.)]\s+([A-Za-z][A-Za-z\t .,'()-]{2,70})/gm)) {
        const val = cleanParsedField(m[1]);
        if (val && !/^(asesor|tuk|tanggal|skema|nomor)\b/i.test(val)) {
          extraNames.push(val);
        }
      }
    }
  }

  const candidateNames = Array.from(new Set([...baseNames, ...extraNames]));

  return {
    assessmentDate,
    tukName,
    assessorName,
    letterNumber,
    candidateNames,
  };
}
