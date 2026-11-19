import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import { inferMimeTypeFromFileName } from "@/services/extract";

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
 * Evaluates filename tokens with strict word boundaries first so parent folders
 * like "Persyaratan Pelatihan" never override individual assessee documents, and
 * separates instructional "Materi" handouts from trainee forms/certificates.
 */
export function classifyDriveFileName(
  fileName: string,
  parentPath = "",
): ClassificationResult {
  const fnLower = fileName.toLowerCase();
  const fnBase = fnLower
    .replace(/\.[a-z0-9]{2,5}(?:\.[a-z0-9]{2,5})?$/i, "")
    .replace(/\(\d+\)|-v\d+|-\d+(?=$|\s)/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const ppNorm = parentPath
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1. Training materials & syllabus live in Materi folders or carry module prefixes
  if (
    /(?:^|\/)\s*materi(?:\s|$|\/)/i.test(ppNorm) ||
    /^(?:cover\s+materi|silabus|tata\s*tertib|\d+(?:\s*&\s*\d+)?\.\s*ahli\s*k3|modul\b|materi\b|handout\b|bahan\s*ajar\b|\d+\.\s*pengantar\s*pelatihan\b)/i.test(
      fnBase,
    )
  ) {
    return {
      docType: "materi_pelatihan",
      confidence: 0.92,
      reason: "Materi atau silabus pelatihan",
    };
  }

  // 2. Identity & BNSP administrative forms (underscore-safe boundaries)
  if (/(?:^|\s)ktpp?(?:$|\s)|kartu\s*tanda\s*penduduk|(?:^|\s)nik(?:$|\s)/i.test(fnBase)) {
    return { docType: "ktp", confidence: 0.95, reason: "Dokumen identitas KTP" };
  }
  if (/apl[\s.]*0?1|permohonan\s*sertifikasi/i.test(fnBase)) {
    return { docType: "apl01", confidence: 0.95, reason: "Formulir permohonan FR.APL.01" };
  }
  if (/apl[\s.]*0?2|asesmen\s*mandiri/i.test(fnBase)) {
    return { docType: "apl02", confidence: 0.95, reason: "Formulir asesmen mandiri FR.APL.02" };
  }
  if (
    /(?:^|\s)04a(?:$|\s)|ia[\s.]*04a|instruksi\s*terstruktur|daftar\s*instruksi|soal\s*dit|panduan\s*(?:tugas\s*)?dit/i.test(
      fnBase,
    )
  ) {
    return {
      docType: "04a",
      confidence: 0.92,
      reason: "Daftar Instruksi Terstruktur FR.IA.04A",
    };
  }
  if (/(?:^|\s)04b(?:$|\s)|ia[\s.]*04b|observasi\s*demonstrasi|presentasi/i.test(fnBase)) {
    return {
      docType: "04b",
      confidence: 0.9,
      reason: "Presentasi / Demonstrasi DIT FR.IA.04B",
    };
  }
  if (/(?:^|\s)06a(?:$|\s)|ia[\s.]*06a/i.test(fnBase)) {
    return { docType: "06a", confidence: 0.92, reason: "Soal tertulis FR.IA.06A" };
  }
  if (/(?:^|\s)06b(?:$|\s)|ia[\s.]*06b|(?:^|\s)kunci(?:$|\s)/i.test(fnBase)) {
    return { docType: "06b", confidence: 0.92, reason: "Kunci jawaban FR.IA.06B" };
  }
  if (/(?:^|\s)06c(?:$|\s)|ia[\s.]*06c|(?:^|\s)jawaban(?:$|\s)/i.test(fnBase)) {
    return { docType: "06c", confidence: 0.92, reason: "Lembar jawaban tertulis FR.IA.06C" };
  }
  if (/fr[\s.]*ia[\s.]*09|ia[\s.]*09|wawancara/i.test(fnBase)) {
    return { docType: "09", confidence: 0.88, reason: "Formulir wawancara FR.IA.09" };
  }

  // 3. DIT presentation slides (.ppt/.pptx in Tugas DIT/Tugas folder or carrying DIT/Pekerjaan/Penugasan token)
  if (
    /\.pptx?$/i.test(fnLower) &&
    (/tugas\s*dit|(?:^|\/)\s*tugas\s*(?:$|\/)/i.test(ppNorm) ||
      /(?:^|\s)(?:dit|pekerjaan|penugasan|tugas)(?:$|\s)/i.test(fnBase))
  ) {
    return {
      docType: "04b",
      confidence: 0.88,
      reason: "Salindia presentasi / penugasan DIT (.ppt/.pptx)",
    };
  }

  // 4. Operational DIT worksheets requested by FR.IA.04A (.docx/.doc/.pdf/.xlsx/.pptx)
  if (
    !/\.zip$|\.rar$/i.test(fnLower) &&
    /(?:form(?:ulir)?\s*(?:ibpr|hiradc|erp|work\s*permit|permit\s*kerja|izin\s*kerja|inspeksi|in[ve]*stigasi)|(?:^|\s)(?:ibpr|hiradc|erp)(?:$|\s)|work\s*permit|permit\s*kerja|izin\s*kerja|inspeksi\s*(?:p3k|apd)|in[ve]*stigasi(?:\s*kecelakaan)?|^[1-6][\s.]+form\b)/i.test(
      fnBase,
    )
  ) {
    return {
      docType: "dit_form",
      confidence: 0.9,
      reason:
        "Formulir pendukung tugas DIT FR.IA.04A (IBPR/HIRADC, ERP, Work Permit, Inspeksi, atau Investigasi)",
    };
  }

  // 5. Academic & employment administrative documents (with typo & Roman-numeral support)
  if (
    /ijaz?ah|ijasah|ijajah|transkrip\s*nilai|sertifikat\s*kelulusan|surat\s*keterangan\s*(?:ll?ulus|kuliah|pendidikan)|\bsu?ket\s*(?:ll?ulus|s\s*[123])|\bs\s*[12]\b/i.test(
      fnBase,
    )
  ) {
    return {
      docType: "ijazah",
      confidence: 0.9,
      reason: "Ijazah / surat keterangan pendidikan",
    };
  }
  if (/(?:^|\s)cv(?:$|\s)|curr?iculum\s*vitae|daftar\s*riwayat\s*hidup/i.test(fnBase)) {
    return {
      docType: "cv",
      confidence: 0.9,
      reason: "Daftar riwayat hidup (CV)",
    };
  }
  if (
    /surat\s*(?:tugas|perintah|ket(?:erangan)?\s*(?:be)?kerja|ke\s*kerja|pengalaman|kenaikan\s*pangkat)|\bsk\s*(?:kerja|pns|pppk|kepangkatan|kenaikan\s*pangkat|gol|3[ab]|i{1,3}[\s.]*[a-d]|iv[\s.]*[a-e])|\bketerangan\s*(?:be)?kerja\b|^sk$|\bst\b/i.test(
      fnBase,
    )
  ) {
    return {
      docType: "surat_tugas",
      confidence: 0.9,
      reason: "Surat tugas / SK / surat keterangan kerja",
    };
  }
  if (/portofolio|paklaring|jobdesc|laporan\s*kerja|pengalaman\s*lapangan/i.test(fnBase)) {
    return {
      docType: "portofolio",
      confidence: 0.85,
      reason: "Dokumen portofolio / pengalaman kerja asesi",
    };
  }
  if (
    /pas+\s*p?f?oto|foto\s*3x4|(?:^|\s)(?:photo|foto)(?:$|\s)|latar\s*merah|bg\s*merah|merah\s*batik|fococlipping/i.test(
      fnBase,
    )
  ) {
    return { docType: "pas_foto", confidence: 0.88, reason: "Pas foto asesi" };
  }
  if (/sertifikat|pelatihan|pembinaan/i.test(fnBase)) {
    return {
      docType: "sertifikat_pelatihan",
      confidence: 0.82,
      reason: "Sertifikat pelatihan / pembinaan",
    };
  }

  // 6. Multi-format DIT project submissions (.docx / .pdf / .pptx) under Tugas DIT / Tugas or carrying DIT token
  if (
    /tugas\s*dit|(?:^|\/)\s*tugas\s*(?:$|\/)/i.test(ppNorm) ||
    /(?:^|\s)dit(?:$|\s)/i.test(fnBase)
  ) {
    if (/\.(pptx?|pdf|docx?)$/i.test(fnLower)) {
      return {
        docType: "04b",
        confidence: 0.85,
        reason: "Dokumen penugasan / proyek DIT (.pptx/.pdf/.docx)",
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
    confidence: 0.1,
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
): ClassificationResult | null {
  const norm = rawText.replace(/\s+/g, " ").trim();
  if (norm.length < 15) return null;

  const lower = norm.toLowerCase();
  const isPptOrTugas =
    /\.pptx?$/i.test(fileName) || /tugas\s*dit|(?:^|\/)\s*tugas(?:\s|$|\/)/i.test(parentPath);

  if (
    /\bfr[\s._-]*ia[\s._-]*04a\b|daftar\s*instruksi\s*terstruktur|penjelasan\s*proyek\s*singkat/i.test(
      lower,
    )
  ) {
    return {
      docType: "04a",
      confidence: 0.91,
      reason: "Terdeteksi dari isi dokumen: memuat judul/formulir FR.IA.04A",
    };
  }
  if (/\bfr[\s._-]*ia[\s._-]*04b\b|penilaian\s*proyek\s*singkat/i.test(lower)) {
    return {
      docType: "04b",
      confidence: 0.9,
      reason: "Terdeteksi dari isi dokumen: memuat FR.IA.04B",
    };
  }
  if (/\bfr[\s._-]*apl[\s._-]*01\b|permohonan\s*sertifikasi\s*kompetensi/i.test(lower)) {
    return {
      docType: "apl01",
      confidence: 0.93,
      reason: "Terdeteksi dari isi dokumen: formulir FR.APL.01",
    };
  }
  if (/\bfr[\s._-]*apl[\s._-]*02\b|asesmen\s*mandiri/i.test(lower)) {
    return {
      docType: "apl02",
      confidence: 0.93,
      reason: "Terdeteksi dari isi dokumen: formulir FR.APL.02",
    };
  }
  if (/\bfr[\s._-]*ia[\s._-]*06c\b|lembar\s*jawaban\s*tertulis/i.test(lower)) {
    return {
      docType: "06c",
      confidence: 0.9,
      reason: "Terdeteksi dari isi dokumen: lembar jawaban FR.IA.06C",
    };
  }
  if (/\bfr[\s._-]*ia[\s._-]*06b\b|kunci\s*jawaban\s*pertanyaan\s*tertulis/i.test(lower)) {
    return {
      docType: "06b",
      confidence: 0.9,
      reason: "Terdeteksi dari isi dokumen: kunci jawaban FR.IA.06B",
    };
  }
  if (/\bfr[\s._-]*ia[\s._-]*06a\b|daftar\s*pertanyaan\s*tertulis/i.test(lower)) {
    return {
      docType: "06a",
      confidence: 0.9,
      reason: "Terdeteksi dari isi dokumen: soal tertulis FR.IA.06A",
    };
  }
  if (/\bfr[\s._-]*ia[\s._-]*09\b|daftar\s*pertanyaan\s*wawancara/i.test(lower)) {
    return {
      docType: "09",
      confidence: 0.88,
      reason: "Terdeteksi dari isi dokumen: formulir wawancara FR.IA.09",
    };
  }
  if (
    /identifikasi\s*bahaya|penilaian\s*risiko|\bibpr\b|\bhiradc\b|work\s*permit|izin\s*kerja|emergency\s*response|tanggap\s*darurat|inspeksi\s*p3k|investigasi\s*kecelakaan/i.test(
      lower,
    )
  ) {
    if (/\.pptx?$/i.test(fileName)) {
      return {
        docType: "04b",
        confidence: 0.89,
        reason: "Terdeteksi dari isi salindia: paparan tugas DIT K3",
      };
    }
    return {
      docType: "dit_form",
      confidence: 0.88,
      reason: "Terdeteksi dari isi dokumen: formulir kerja tugas DIT (IBPR/HIRADC/ERP/Work Permit/Inspeksi/Investigasi)",
    };
  }
  if (
    /daftar\s*riwayat\s*hidup|curriculum\s*vitae|riwayat\s*pendidikan|pengalaman\s*kerja/i.test(
      lower,
    )
  ) {
    return {
      docType: "cv",
      confidence: 0.88,
      reason: "Terdeteksi dari isi dokumen: riwayat hidup / CV",
    };
  }
  if (
    /kartu\s*tanda\s*penduduk|nik\s*:?\s*\d{12,16}|provinsi[\s\S]{0,60}kabupaten|gol\.?\s*darah/i.test(
      lower,
    )
  ) {
    return {
      docType: "ktp",
      confidence: 0.9,
      reason: "Terdeteksi dari hasil OCR/teks: dokumen identitas KTP",
    };
  }
  if (
    /surat\s*tugas|surat\s*keterangan\s*kerja|kenaikan\s*pangkat|memutuskan\s*:|mengangkat\s*sdr/i.test(
      lower,
    )
  ) {
    return {
      docType: "surat_tugas",
      confidence: 0.88,
      reason: "Terdeteksi dari isi dokumen: surat tugas / SK kepegawaian",
    };
  }
  if (
    /ijas?zah|surat\s*keterangan\s*(?:lulus|mahasiswa|kuliah)|transkrip\s*nilai|program\s*studi|magister|sarjana/i.test(
      lower,
    )
  ) {
    return {
      docType: "ijazah",
      confidence: 0.88,
      reason: "Terdeteksi dari isi dokumen: ijazah / surat keterangan studi",
    };
  }
  if (isPptOrTugas && /\.(pptx?|pdf|docx?)$/i.test(fileName)) {
    return {
      docType: "04b",
      confidence: 0.84,
      reason: "Terdeteksi dari isi dokumen dalam folder Tugas DIT",
    };
  }

  return null;
}

/**
 * Extracts clean participant display names from FR.APL.01 / Surat Tugas text when present
 * (adapted from MUK helper — exposes names only, never unmasked NIK/phone).
 */
export function extractCandidateNamesFromDocumentText(
  docType: string,
  text: string,
): string[] {
  const names: string[] = [];
  if (docType === "apl01") {
    const m = text.match(/Nama\s*lengkap\s*:?\s*([A-Za-z][A-Za-z\s.,'()-]{2,80})/i);
    const val = m?.[1]?.split(/\r?\n|No\.?\s*KTP|NIK|Tempat/i)[0]?.trim();
    if (val && val.length >= 3) names.push(val);
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
      const { docType, confidence, reason } = classifyDriveFileName(name, parentPath);
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
        });
        results.push(...nested);
      } else {
        const { docType, confidence, reason } = classifyDriveFileName(f.name, params.parentPath);
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
  /^(?:materi|pelatihan|persyaratan|tugas\s*dit|skema|muk|kelengkapan|dokumen\s*uji|kelompok(?:\s*pekerjaan)?|form(?:ulir)?|ibpr|hiradc|erp|work\s*permit|inspeksi|investigasi|arsip|revisi|final|template|online|onsite)\b|^(?:ba|docs|_docs_|asesmen|metode|k3|ak3u|lsp)$/i;

export interface CandidateInference {
  candidateName: string | null;
  isAuthoritativeRoster: boolean;
}

const FILE_EXT_STRIP_RE =
  /(?:\.(?:pdf|docx?|pptx?|xlsx?|csv|txt|zip|rar|7z|jpe?g|png|webp|gif|bmp|md))+$/i;

export function cleanCandidateLabel(raw: string): string {
  return raw
    .replace(FILE_EXT_STRIP_RE, "")
    .replace(/^\d+[\s._-]+/, "")
    .replace(/[_]+/g, " ")
    .replace(/^(?:tugas\s*presentasi\s*dit|tugas\s*dit|tugas\s*\d+|tugas|dit|presentasi)(?:$|\s+)/i, "")
    .replace(/\(\d+\)$/g, "")
    .replace(/(?:\s+|[-._]+)(?:v\d+|rev\s*\d*|final|k3|ak3u|bnsp)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulCandidateLabel(cleaned: string): boolean {
  if (cleaned.length < 2) return false;
  if (NON_CANDIDATE_FOLDER_RE.test(cleaned)) return false;
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
      if (next && !NON_CANDIDATE_FOLDER_RE.test(next)) {
        const cleaned = cleanCandidateLabel(next);
        if (isUsefulCandidateLabel(cleaned)) {
          return { candidateName: cleaned, isAuthoritativeRoster: true };
        }
      }
    }

    if (/tugas\s*dit/i.test(folder)) {
      const next = folders[i + 1];
      if (next && !NON_CANDIDATE_FOLDER_RE.test(next)) {
        const cleaned = cleanCandidateLabel(next);
        if (isUsefulCandidateLabel(cleaned)) {
          return { candidateName: cleaned, isAuthoritativeRoster: false };
        }
      }
      if (/\.(pptx|ppt|pdf|docx|doc|zip)$/i.test(fileName)) {
        const base = fileName.replace(FILE_EXT_STRIP_RE, "");
        if (/^(?:tugas|dit)(?:$|[\s._-])/i.test(base)) {
          const withoutPart = base.split(/\s+-\s+pt\b/i)[0] ?? base;
          const cleaned = cleanCandidateLabel(withoutPart);
          if (isUsefulCandidateLabel(cleaned)) {
            return { candidateName: cleaned, isAuthoritativeRoster: false };
          }
        }
      }
    }
  }

  // Fallback: direct parent folder if not a generic structural category
  const immediateParent = folders[folders.length - 1] ?? "";
  if (immediateParent && !NON_CANDIDATE_FOLDER_RE.test(immediateParent)) {
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
