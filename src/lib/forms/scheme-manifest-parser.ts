import crypto from "node:crypto";
import JSZip from "jszip";
import { z } from "zod";
import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import type {
  SchemeInterviewQuestionSpec,
  SchemeKelompokSpec,
  SchemeWrittenQuestionSpec,
} from "@/repositories/schemes.repository";

export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_BLANKO_BYTES = 10 * 1024 * 1024; // 10 MB

export const INSTRUMENT_ROLE_OPTIONS = [
  { value: "administrasi", label: "Administrasi (APL / Berita Acara / SK)" },
  { value: "portofolio", label: "Verifikasi Portofolio / Bukti Kerja" },
  { value: "dit", label: "DIT — Daftar Instruksi Terstruktur (04A)" },
  { value: "presentation", label: "Presentasi / Penilaian Proyek (04B)" },
  { value: "written_soal", label: "Soal Tertulis (06A)" },
  { value: "written_kunci", label: "Kunci Jawaban Tertulis (06B)" },
  { value: "written_jawaban", label: "Lembar Jawaban Tertulis (06C)" },
  { value: "interview", label: "Pertanyaan Wawancara (09)" },
  { value: "keputusan", label: "Rekaman Asesmen (AK.02)" },
  { value: "laporan", label: "Laporan Asesmen (AK.05)" },
  { value: "mapa", label: "Perencanaan Asesmen (MAPA)" },
  { value: "custom", label: "Instrumen Khusus Skema Lainnya" },
] as const;

export const SchemeFormDraftSchema = z.object({
  formKey: z
    .string()
    .trim()
    .min(1, "Kode formulir wajib diisi.")
    .max(64, "Kode formulir maksimal 64 karakter.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Kode formulir hanya boleh berisi huruf, angka, '.', '_', atau '-'."),
  formName: z.string().trim().max(200).default(""),
  instrumentRole: z.string().trim().min(1, "Peran instrumen wajib dipilih.").max(64),
  required: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  filePatterns: z
    .array(z.string().trim().min(1))
    .min(1, "Setiap formulir wajib memiliki minimal satu pola nama file."),
});

export type SchemeFormDraftInput = z.infer<typeof SchemeFormDraftSchema>;

export function sanitizeBlankoFileName(rawName: string): string {
  const base = rawName.split(/[/\\]/).pop() ?? "blanko.docx";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  const ensured = cleaned || "blanko.docx";
  return ensured.toLowerCase().endsWith(".docx") ? ensured : `${ensured}.docx`;
}

export async function validateDocxBlankoBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<
  | { valid: true; sha256: string; safeFileName: string }
  | { valid: false; error: string }
> {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Berkas blanko .docx kosong." };
  }
  if (buffer.length > MAX_BLANKO_BYTES) {
    return {
      valid: false,
      error: `Ukuran berkas blanko melebihi batas maksimal ${Math.round(MAX_BLANKO_BYTES / (1024 * 1024))} MB.`,
    };
  }
  const hasZipMagic =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;
  if (!hasZipMagic) {
    return {
      valid: false,
      error: "Berkas ditolak: format bukan arsip .docx (OOXML ZIP) yang valid.",
    };
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    if (!zip.file("word/document.xml")) {
      return {
        valid: false,
        error: "Berkas .docx tidak memuat word/document.xml yang valid.",
      };
    }
  } catch {
    return {
      valid: false,
      error: "Berkas .docx rusak atau terenkripsi sehingga tidak dapat dibaca sistem.",
    };
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  return {
    valid: true,
    sha256,
    safeFileName: sanitizeBlankoFileName(fileName),
  };
}

export function parseUnitsLines(raw: string): Array<{ code: string; title: string }> {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const sep = line.includes("|") ? "|" : line.includes("—") ? "—" : null;
      if (sep) {
        const [rawCode, ...rest] = line.split(sep);
        const code = (rawCode ?? "").trim() || `UNIT.${String(idx + 1).padStart(2, "0")}`;
        const title = rest.join(sep).trim() || code;
        return { code, title };
      }
      return { code: `UNIT.${String(idx + 1).padStart(2, "0")}`, title: line };
    });
}

/**
 * Parses lines of FR.IA.04B official questions into structured `SchemeKelompokSpec[]`.
 * Supported pipe-separated formats (one per line):
 * - `KP_NO | UNIT_CODE | Lingkup | Pertanyaan | KUK` (5 parts)
 * - `UNIT_CODE | Lingkup | Pertanyaan | KUK` (4 parts, KP 1)
 * - `UNIT_CODE | Pertanyaan | KUK` (3 parts, KP 1)
 * - `UNIT_CODE | Pertanyaan` (2 parts, KP 1)
 * - `Pertanyaan` (1 part, mapped sequentially onto `units`)
 */
export function parse04bQuestionsToKelompok(
  raw: string,
  units: Array<{ code: string; title: string }>,
): SchemeKelompokSpec[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const unitByCode = new Map(units.map((u) => [u.code.trim().toLowerCase(), u]));
  const kpMap = new Map<
    number,
    {
      kpIndex: number;
      title: string;
      unitsMap: Map<string, { code: string; title: string }>;
      aspects: SchemeKelompokSpec["aspects"];
    }
  >();

  lines.forEach((line, idx) => {
    const parts = line.split("|").map((p) => p.trim());
    let kpIndex = 1;
    let unitCode = units[idx]?.code ?? `UNIT.${String(idx + 1).padStart(2, "0")}`;
    let lingkup = "";
    let question = "";
    let kukRef = "";

    if (parts.length >= 5) {
      const maybeKp = Number(parts[0]);
      kpIndex = Number.isInteger(maybeKp) && maybeKp >= 1 ? maybeKp : 1;
      unitCode = parts[1] || unitCode;
      lingkup = parts[2] || "";
      question = parts[3] || "";
      kukRef = parts.slice(4).join(" | ");
    } else if (parts.length === 4) {
      unitCode = parts[0] || unitCode;
      lingkup = parts[1] || "";
      question = parts[2] || "";
      kukRef = parts[3] || "";
    } else if (parts.length === 3) {
      unitCode = parts[0] || unitCode;
      question = parts[1] || "";
      kukRef = parts[2] || "";
    } else if (parts.length === 2) {
      unitCode = parts[0] || unitCode;
      question = parts[1] || "";
    } else {
      question = parts[0] || "";
    }

    if (!question) return;

    const matchedUnit = unitByCode.get(unitCode.toLowerCase());
    const unitTitle = matchedUnit?.title ?? unitCode;
    const resolvedUnitCode = matchedUnit?.code ?? unitCode;

    let bucket = kpMap.get(kpIndex);
    if (!bucket) {
      bucket = {
        kpIndex,
        title: `Kelompok Pekerjaan ${kpIndex}`,
        unitsMap: new Map(),
        aspects: [],
      };
      kpMap.set(kpIndex, bucket);
    }

    bucket.unitsMap.set(resolvedUnitCode.toLowerCase(), {
      code: resolvedUnitCode,
      title: unitTitle,
    });
    bucket.aspects.push({
      kpIndex,
      no: bucket.aspects.length + 1,
      unitCode: resolvedUnitCode,
      unitTitle,
      lingkup: lingkup || unitTitle,
      question,
      kukRef: kukRef || `${resolvedUnitCode} — ${unitTitle}`,
    });
  });

  return Array.from(kpMap.values())
    .sort((a, b) => a.kpIndex - b.kpIndex)
    .map((bucket) => ({
      kpIndex: bucket.kpIndex,
      title: bucket.title,
      isGenericFallback: false,
      units: Array.from(bucket.unitsMap.values()).map((u, idx) => ({
        no: idx + 1,
        code: u.code,
        title: u.title,
      })),
      aspects: bucket.aspects,
    }));
}

export function formatKelompokTo04bText(kps?: SchemeKelompokSpec[]): string {
  if (!Array.isArray(kps) || kps.length === 0) return "";
  const lines: string[] = [];
  for (const kp of kps) {
    if (kp.isGenericFallback) continue;
    for (const a of kp.aspects) {
      lines.push(
        `${kp.kpIndex} | ${a.unitCode} | ${a.lingkup} | ${a.question} | ${a.kukRef}`,
      );
    }
  }
  return lines.join("\n");
}

export function parseWrittenQuestionsLines(raw: string): SchemeWrittenQuestionSpec[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 2 && parts[1]) {
        return {
          no: idx + 1,
          unitCode: parts[0] || undefined,
          question: parts.slice(1).join(" | "),
        };
      }
      return {
        no: idx + 1,
        question: line,
      };
    });
}

export function formatWrittenQuestionsToText(
  questions?: SchemeWrittenQuestionSpec[],
): string {
  if (!Array.isArray(questions) || questions.length === 0) return "";
  return questions
    .map((q) => (q.unitCode ? `${q.unitCode} | ${q.question}` : q.question))
    .join("\n");
}

export function parseInterviewQuestionsLines(raw: string): SchemeInterviewQuestionSpec[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 2 && parts[1]) {
        return {
          no: idx + 1,
          unitCode: parts[0] || undefined,
          question: parts.slice(1).join(" | "),
        };
      }
      return {
        no: idx + 1,
        question: line,
      };
    });
}

export function formatInterviewQuestionsToText(
  questions?: SchemeInterviewQuestionSpec[],
): string {
  if (!Array.isArray(questions) || questions.length === 0) return "";
  return questions
    .map((q) => (q.unitCode ? `${q.unitCode} | ${q.question}` : q.question))
    .join("\n");
}

export function validateBrandingLogoUrl(raw?: string | null): {
  valid: boolean;
  value?: string;
  error?: string;
} {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { valid: true, value: undefined };
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.includes("..")) {
      return { valid: false, error: "Path logo lokal tidak valid." };
    }
    return { valid: true, value: trimmed };
  }
  const check = validateSafeExternalUrl(trimmed);
  if (!check.safe) {
    return { valid: false, error: `URL logo tidak aman: ${check.reason}` };
  }
  return { valid: true, value: trimmed };
}
