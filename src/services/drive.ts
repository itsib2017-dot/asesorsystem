import { validateSafeExternalUrl } from "@/lib/security/ssrf";

export interface ClassifiedDriveFile {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  drivePath: string;
  docType: string;
  confidence: number;
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

/**
 * Classifies messy BNSP Drive filenames into normalized document types (M1.2).
 * Handles duplicate markers (1), -2, -v2 and double extensions (.jpg.jpeg).
 */
export function classifyDriveFileName(
  fileName: string,
  parentPath = "",
): { docType: string; confidence: number } {
  const normalized = `${parentPath}/${fileName}`
    .toLowerCase()
    .replace(/\(\d+\)|-v\d+|-\d+(?=\.)/g, "")
    .replace(/[_-]+/g, " ")
    .trim();

  if (/\bktp\b|kartu tanda penduduk|nik/i.test(normalized)) {
    return { docType: "ktp", confidence: 0.95 };
  }
  if (/\bapl[\s.]*0?1\b/i.test(normalized)) {
    return { docType: "apl01", confidence: 0.95 };
  }
  if (/\bapl[\s.]*0?2\b/i.test(normalized)) {
    return { docType: "apl02", confidence: 0.95 };
  }
  if (/ijazah|transkrip nilai|sertifikat kelulusan/i.test(normalized)) {
    return { docType: "ijazah", confidence: 0.9 };
  }
  if (/pas\s*foto|foto\s*3x4|photo/i.test(normalized)) {
    return { docType: "pas_foto", confidence: 0.85 };
  }
  if (/\bcv\b|curriculum vitae|daftar riwayat hidup/i.test(normalized)) {
    return { docType: "cv", confidence: 0.9 };
  }
  if (/surat\s*tugas|st\b/i.test(normalized)) {
    return { docType: "surat_tugas", confidence: 0.9 };
  }
  if (/\b04a\b|ia[\s.]*04a|\bdit\b|instruksi terstruktur/i.test(normalized)) {
    return { docType: "04a", confidence: 0.92 };
  }
  if (/\b04b\b|ia[\s.]*04b|presentasi/i.test(normalized)) {
    return { docType: "04b", confidence: 0.9 };
  }
  if (/\b06a\b|ia[\s.]*06a/i.test(normalized)) {
    return { docType: "06a", confidence: 0.92 };
  }
  if (/\b06b\b|ia[\s.]*06b|kunci/i.test(normalized)) {
    return { docType: "06b", confidence: 0.92 };
  }
  if (/\b06c\b|ia[\s.]*06c|jawaban/i.test(normalized)) {
    return { docType: "06c", confidence: 0.92 };
  }
  if (/\b09\b|ia[\s.]*09|wawancara/i.test(normalized)) {
    return { docType: "09", confidence: 0.88 };
  }
  if (/sertifikat|pelatihan|pembinaan/i.test(normalized)) {
    return { docType: "sertifikat_pelatihan", confidence: 0.82 };
  }
  if (/portofolio|sk kerja|paklaring|jobdesc|laporan kerja/i.test(normalized)) {
    return { docType: "portofolio", confidence: 0.8 };
  }

  return { docType: "unknown", confidence: 0.1 };
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

function inferMimeTypeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".csv")) return "text/csv";
  return "application/octet-stream";
}

export async function crawlPublicDriveFolderEmbedded(
  folderId: string,
  parentPath = "",
  depth = 0,
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
      const { docType, confidence } = classifyDriveFileName(name, parentPath);
      files.push({
        driveFileId: entryId,
        fileName: name,
        mimeType: inferMimeTypeFromFileName(name),
        drivePath: currentPath,
        docType,
        confidence,
      });
    }
  }

  // Bounded concurrency across subfolders to avoid hitting serverless limits
  const CONCURRENCY = 6;
  for (let i = 0; i < subfolders.length; i += CONCURRENCY) {
    const chunk = subfolders.slice(i, i + CONCURRENCY);
    const nestedLists = await Promise.all(
      chunk.map((sf) => crawlPublicDriveFolderEmbedded(sf.id, sf.path, depth + 1)),
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
}): Promise<ClassifiedDriveFile[]> {
  const results: ClassifiedDriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const query = encodeURIComponent(`'${params.folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=nextPageToken,files(id,name,mimeType)&pageSize=100${
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
      files?: Array<{ id: string; name: string; mimeType: string }>;
    };

    for (const f of body.files ?? []) {
      const currentPath = params.parentPath ? `${params.parentPath}/${f.name}` : f.name;
      if (f.mimeType === "application/vnd.google-apps.folder") {
        const nested = await crawlPublicDriveFolderApi({
          folderId: f.id,
          apiKey: params.apiKey,
          parentPath: currentPath,
        });
        results.push(...nested);
      } else {
        const { docType, confidence } = classifyDriveFileName(f.name, params.parentPath);
        results.push({
          driveFileId: f.id,
          fileName: f.name,
          mimeType: f.mimeType,
          drivePath: currentPath,
          docType,
          confidence,
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
}): Promise<ClassifiedDriveFile[]> {
  const key = params.apiKey?.trim();
  if (key) {
    try {
      return await crawlPublicDriveFolderApi({
        folderId: params.folderId,
        apiKey: key,
        parentPath: params.parentPath,
      });
    } catch {
      // Fall through to keyless public HTML listing when key is restricted/invalid
    }
  }

  return crawlPublicDriveFolderEmbedded(params.folderId, params.parentPath ?? "", 0);
}

const NON_CANDIDATE_FOLDER_RE =
  /^(materi|pelatihan|persyaratan|tugas\s*dit|skema|muk|ba|kelengkapan|docs|_docs_|online|onsite|asesmen)/i;

function cleanCandidateLabel(raw: string): string {
  return raw
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/^\d+[\s._-]+/, "")
    .replace(/^(?:tugas\s*presentasi\s*dit|tugas\s*dit|tugas\s*\d+|dit)[\s._-]+/i, "")
    .replace(/\s*-\s*v\d+$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Infers an assessee's display name from a Drive file path or DIT filename.
 * Handles common BNSP folder patterns such as:
 * - `Persyaratan Pelatihan AK3 umum BNSP/1. Susilo Heni S. S.K.M/KTP Heni.jpg`
 * - `Pelatihan .../Tugas DIT/11. LINTANG SEPTYANJANI/...`
 * - `Pelatihan .../Tugas DIT/TUGAS PRESENTASI DIT Dina Oktavia Anggriani.pptx`
 */
export function inferCandidateNameFromDrivePath(
  drivePath: string,
  fileName: string,
): string | null {
  const segments = drivePath.split("/").map((s) => s.trim()).filter(Boolean);
  if (segments.length <= 1) return null;

  // Parent folders excluding the filename itself
  const folders = segments.slice(0, -1);

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i] ?? "";
    if (/persyaratan|asesi|peserta|kandidat/i.test(folder)) {
      const next = folders[i + 1];
      if (next && !NON_CANDIDATE_FOLDER_RE.test(next)) {
        const cleaned = cleanCandidateLabel(next);
        if (cleaned.length >= 2) return cleaned;
      }
    }

    if (/tugas\s*dit/i.test(folder)) {
      const next = folders[i + 1];
      if (next) {
        const cleaned = cleanCandidateLabel(next);
        if (cleaned.length >= 2) return cleaned;
      } else if (/\.(pptx|ppt|pdf|docx)$/i.test(fileName)) {
        const base = fileName.replace(/\.[a-z0-9]{2,4}$/i, "");
        if (/^(?:tugas|dit)\b/i.test(base)) {
          const withoutPart = base
            .split(/\s+-\s+pt\b/i)[0] ?? base;
          const cleaned = cleanCandidateLabel(withoutPart);
          if (cleaned.length >= 2 && !/^(presentasi|tugas|dit)$/i.test(cleaned)) {
            return cleaned;
          }
        }
      }
    }
  }

  // Fallback: direct parent folder if not a generic structural category
  const immediateParent = folders[folders.length - 1] ?? "";
  if (
    immediateParent &&
    !NON_CANDIDATE_FOLDER_RE.test(immediateParent) &&
    !/^(persyaratan dasar|dokumen uji|metode)/i.test(immediateParent)
  ) {
    const cleaned = cleanCandidateLabel(immediateParent);
    if (cleaned.length >= 2) return cleaned;
  }

  return null;
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
