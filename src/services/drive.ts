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
 * and exponential backoff on 429/403 rate limits.
 */
export async function crawlPublicDriveFolder(params: {
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
        const nested = await crawlPublicDriveFolder({
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
