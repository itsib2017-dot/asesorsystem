import type {
  Ak02EvidenceType,
  Ak02ExportPayload,
  Ia04aExportPayload,
  Ia04bExportPayload,
  Ia06cExportPayload,
} from "@/services/export";
import type {
  SchemeBrandingConfig,
  SchemeInterviewQuestionSpec,
  SchemeKelompokSpec,
  SchemeRecord,
  SchemeWrittenQuestionSpec,
} from "@/repositories/schemes.repository";
import {
  resolveAssesseeOverallDecision,
  type OverallDecisionOverrideLike,
  type ResolvedOverallDecision,
} from "@/lib/ak05/decision-rules";
import { readArrayField, readField, readStringField } from "@/lib/utils/record-fields";

export const AK3U_OFFICIAL_UNITS = [
  "Merancang Strategi Pengendalian Risiko K3 di Tempat Kerja",
  "Merancang Sistem Tanggap Darurat",
  "Melakukan Komunikasi K3",
  "Mengawasi Pelaksanaan Izin Kerja",
  "Melakukan Pengukuran Faktor Bahaya di Tempat Kerja",
  "Mengelola Pertolongan Pertama pada Kecelakaan Kerja (P3K) di Tempat Kerja",
  "Mengelola Tindakan Tanggap Darurat",
  "Mengelola Alat Pelindung Diri (APD) di Tempat Kerja",
  "Menerapkan Program Pelayanan Kesehatan Kerja",
  "Mengelola Sistem Dokumentasi K3",
  "Menerapkan Manajemen Risiko K3",
  "Mengevaluasi Pemenuhan Persyaratan dan Prosedur K3",
  "Melakukan Investigasi Kecelakaan Kerja",
] as const;

export interface Ia04bAspectSpec {
  kpIndex: number;
  no: number;
  unitCode: string;
  unitTitle: string;
  lingkup: string;
  question: string;
  kukRef: string;
}

export type Ia04bKelompokSpec = SchemeKelompokSpec;

export const IA04B_KELOMPOK_PEKERJAAN: Ia04bKelompokSpec[] = [
  {
    kpIndex: 1,
    title: "Kelompok Pekerjaan 1",
    units: [
      { no: 1, code: "M.71KKK01.001.1", title: "Merancang Strategi Pengendalian Risiko K3 di Tempat Kerja" },
      { no: 2, code: "M.71KKK01.005.1", title: "Melakukan Pengukuran Faktor Bahaya di Tempat Kerja" },
      { no: 3, code: "M.71KKK01.011.1", title: "Menerapkan Manajemen Risiko K3" },
      { no: 4, code: "M.71KKK01.008.1", title: "Mengelola Alat Pelindung Diri (APD) di Tempat Kerja" },
      { no: 5, code: "M.71KKK01.009.1", title: "Menerapkan Program Pelayanan Kesehatan Kerja" },
    ],
    aspects: [
      {
        kpIndex: 1,
        no: 1,
        unitCode: "M.71KKK01.001.1",
        unitTitle: "Merancang Strategi Pengendalian Risiko K3 di Tempat Kerja",
        lingkup: "Rancangan strategi pengendalian risiko K3 di tempat kerja",
        question:
          "Metode/teknik identifikasi apa yang digunakan agar kita dapat mengidentifikasi seluruh bahaya dan risiko yang ada di tempat kerja?",
        kukRef: "1.1 Hasil identifikasi faktor bahaya dianalisis pada setiap lokasi di tempat kerja.",
      },
      {
        kpIndex: 1,
        no: 2,
        unitCode: "M.71KKK01.005.1",
        unitTitle: "Melakukan Pengukuran Faktor Bahaya di Tempat Kerja",
        lingkup: "Pengukuran Faktor Bahaya di Tempat Kerja",
        question:
          "Jelaskan faktor-faktor bahaya di tempat kerja! Alat ukurnya apa? Dan Nilai Ambang Batas (NAB) nya berapa yang Anda ketahui? Dimana regulasi yang mengatur hal tersebut?",
        kukRef: "2.5 Hasil pengukuran dibandingkan dengan peraturan perundang-undangan atau standar yang berlaku.",
      },
      {
        kpIndex: 1,
        no: 3,
        unitCode: "M.71KKK01.011.1",
        unitTitle: "Menerapkan Manajemen Risiko K3",
        lingkup: "Manajemen Risiko K3",
        question:
          "Bagaimana penerapan K3 pada pekerjaan di ketinggian/ di ruang terbatas/ panas/ kelistrikan? Jelaskan pengendalian risikonya dan sebagainya!",
        kukRef: "3.1 Pengendalian risiko K3 ditentukan berdasarkan skala prioritas tingkat risiko.",
      },
      {
        kpIndex: 1,
        no: 4,
        unitCode: "M.71KKK01.008.1",
        unitTitle: "Mengelola Alat Pelindung Diri (APD) di Tempat Kerja",
        lingkup: "Pengelolaan Alat Pelindung Diri (APD) di Tempat Kerja",
        question:
          "Apabila Anda menemukan pekerja yang tidak menggunakan APD, sedangkan hal tersebut diwajibkan pada pekerjaan tersebut, tindakan apa yang Anda lakukan? Serta jelaskan bagaimana supaya tindakan bahaya tersebut tidak terjadi lagi!",
        kukRef: "1.3 Prosedur penyimpanan, penggunaan, pemeriksaan dan pemusnahan dipersiapkan sesuai dengan standar yang berlaku.",
      },
      {
        kpIndex: 1,
        no: 5,
        unitCode: "M.71KKK01.009.1",
        unitTitle: "Menerapkan Program Pelayanan Kesehatan Kerja",
        lingkup: "Penerapan Program Pelayanan Kesehatan Kerja",
        question:
          "Program promotif (promosi) dan preventif (pencegahan) apa yang dapat dilakukan untuk mencegah terjadinya penyakit tenaga kerja dan penyakit akibat kerja (PAK)?",
        kukRef: "2.4 Pelaksanaan program pelayanan kesehatan kerja dipastikan sesuai peraturan perundang-undangan.",
      },
    ],
  },
  {
    kpIndex: 2,
    title: "Kelompok Pekerjaan 2",
    units: [
      { no: 1, code: "M.71KKK01.002.1", title: "Merancang Sistem Tanggap Darurat" },
      { no: 2, code: "M.71KKK01.006.1", title: "Mengelola Pertolongan Pertama pada Kecelakaan Kerja (P3K) di Tempat Kerja" },
      { no: 3, code: "M.71KKK01.007.1", title: "Mengelola Tindakan Tanggap Darurat" },
    ],
    aspects: [
      {
        kpIndex: 2,
        no: 1,
        unitCode: "M.71KKK01.002.1",
        unitTitle: "Merancang Sistem Tanggap Darurat",
        lingkup: "Rancangan Sistem Tanggap Darurat",
        question:
          "Jelaskan jenis-jenis APAR menurut media isinya! Jelaskan juga klasifikasi/ kelas kebakaran serta APAR pemadamnya apa?",
        kukRef: "1.2 Sumber daya berkaitan dengan tanggap darurat diidentifikasi berdasarkan ketersediaan dan kebutuhan.",
      },
      {
        kpIndex: 2,
        no: 2,
        unitCode: "M.71KKK01.006.1",
        unitTitle: "Mengelola Pertolongan Pertama pada Kecelakaan Kerja (P3K) di Tempat Kerja",
        lingkup: "Pengelolaan Pertolongan Pertama pada Kecelakaan Kerja (P3K) di Tempat Kerja",
        question:
          "Mengapa penting bagi setiap perusahaan untuk memiliki sistem P3K yang jelas dan terstruktur? Siapa yang bertanggung jawab untuk memberikan pertolongan pertama dalam situasi kecelakaan di tempat kerja?",
        kukRef: "1.1 Fasilitas P3K diidentifikasi sesuai dengan peraturan perundang-undangan yang berlaku.",
      },
      {
        kpIndex: 2,
        no: 3,
        unitCode: "M.71KKK01.007.1",
        unitTitle: "Mengelola Tindakan Tanggap Darurat",
        lingkup: "Pengelolaan Tindakan Tanggap Darurat",
        question:
          "Apabila keadaan darurat terjadi dan diketahui masih ada 1 orang pekerja yang belum berkumpul di titik kumpul, maka apa yang harus dilakukan sebagai tim tanggap darurat?",
        kukRef: "2.1 Program dan prosedur tanggap darurat diterapkan sesuai kondisi darurat yang terjadi.",
      },
    ],
  },
  {
    kpIndex: 3,
    title: "Kelompok Pekerjaan 3",
    units: [
      { no: 1, code: "M.71KKK01.003.1", title: "Melakukan Komunikasi K3" },
      { no: 2, code: "M.71KKK01.004.1", title: "Mengawasi Pelaksanaan Izin Kerja" },
      { no: 3, code: "M.71KKK01.010.1", title: "Mengelola Sistem Dokumentasi K3" },
    ],
    aspects: [
      {
        kpIndex: 3,
        no: 1,
        unitCode: "M.71KKK01.003.1",
        unitTitle: "Melakukan Komunikasi K3",
        lingkup: "Komunikasi K3",
        question:
          "Apabila Anda menyadari terdapat informasi K3 yang tidak/ belum tersampaikan kepada pekerja, sedangkan pekerjaan sudah dimulai, apa yang Anda lakukan?",
        kukRef: "1.3 Petugas K3 yang menangani komunikasi ditentukan tugas dan tanggung jawabnya.",
      },
      {
        kpIndex: 3,
        no: 2,
        unitCode: "M.71KKK01.004.1",
        unitTitle: "Mengawasi Pelaksanaan Izin Kerja",
        lingkup: "Pengawasan Pelaksanaan Izin Kerja",
        question:
          "Bagaimana penerapan izin kerja/ work permit/ permit to work/ SIKA(Pertamina) di tempat kerja Anda? dari perencanaan pekerjaan sampai permit ditutup atau closing permit!",
        kukRef: "2.1 Pelaksanaan prosedur kerja dipantau sesuai izin kerja.",
      },
      {
        kpIndex: 3,
        no: 3,
        unitCode: "M.71KKK01.010.1",
        unitTitle: "Mengelola Sistem Dokumentasi K3",
        lingkup: "Pengelolaan Sistem Dokumentasi K3",
        question:
          "Mengapa penerapan sistem manajemen keselamatan dan kesehatan kerja (SMK3) harus terintegrasi dengan sistem manajemen di perusahaan?",
        kukRef: "1.2 Pihak yang terkait diidentifikasi sesuai kebutuhan aktivitas kerja.",
      },
    ],
  },
  {
    kpIndex: 4,
    title: "Kelompok Pekerjaan 4",
    units: [
      { no: 1, code: "M.71KKK01.013.1", title: "Melakukan Investigasi Kecelakaan Kerja" },
      { no: 2, code: "M.71KKK01.012.1", title: "Mengevaluasi Pemenuhan Persyaratan dan Prosedur K3" },
    ],
    aspects: [
      {
        kpIndex: 4,
        no: 1,
        unitCode: "M.71KKK01.013.1",
        unitTitle: "Melakukan Investigasi Kecelakaan Kerja",
        lingkup: "Investigasi Kecelakaan Kerja",
        question:
          "Pada saat investigasi, jika diketahui korban tidak melakukan tindakan bahaya, sudah bekerja sesuai arahan dan prosedur, akan tetapi tetap mengalami kecelakaan kerja. Berarti penyebabnya darimana, apa yang perlu dievaluasi?",
        kukRef: "2.5 Rekomendasi atau tindakan perbaikan dibuat sesuai hasil investigasi.",
      },
      {
        kpIndex: 4,
        no: 2,
        unitCode: "M.71KKK01.012.1",
        unitTitle: "Mengevaluasi Pemenuhan Persyaratan dan Prosedur K3",
        lingkup: "Evaluasi Pemenuhan Persyaratan dan Prosedur K3",
        question:
          "Output dari kegiatan investigasi kecelakaan kerja adalah laporan, apa fungsi laporan investigasi ini, jelaskan laporan investigasi internal dan eksternal ke siapa!",
        kukRef: "3.1 Hasil penerapan persyaratan dan prosedur K3 yang berlaku di perusahaan disampaikan ke pihak yang terkait.",
      },
    ],
  },
];

export const DEFAULT_DOC_COLUMNS = [
  "APL.01",
  "APL.02",
  "KTP",
  "Ijazah",
  "Pas Foto",
  "CV",
  "04A",
  "06C",
] as const;

export function isAk3uScheme(scheme?: SchemeRecord | null): boolean {
  return Boolean(scheme?.code && scheme.code.trim().toUpperCase() === "AK3U");
}

export function getFallbackAk3uUnits(): Array<{ code: string; title: string }> {
  return IA04B_KELOMPOK_PEKERJAAN.flatMap((kp) =>
    kp.units.map((u) => ({ code: u.code, title: u.title })),
  );
}

export function resolveSchemeUnitsList(
  scheme?: SchemeRecord | null,
): Array<{ code?: string; title: string }> {
  const manifestUnits = scheme?.manifest?.units;
  if (Array.isArray(manifestUnits) && manifestUnits.length > 0) {
    return manifestUnits;
  }
  const kps = scheme?.manifest?.kelompokPekerjaan;
  if (Array.isArray(kps) && kps.length > 0) {
    const kpUnits = kps.flatMap((kp) =>
      (kp.units ?? []).map((u) => ({ code: u.code, title: u.title })),
    );
    if (kpUnits.length > 0) return kpUnits;
  }
  if (!scheme || isAk3uScheme(scheme)) {
    return getFallbackAk3uUnits();
  }
  return [];
}

export function resolveSchemeKelompokPekerjaan(
  scheme?: SchemeRecord | null,
): SchemeKelompokSpec[] {
  const configured = scheme?.manifest?.kelompokPekerjaan;
  if (Array.isArray(configured) && configured.length > 0) {
    return configured;
  }
  const units = scheme?.manifest?.units;
  if (Array.isArray(units) && units.length > 0) {
    if (isAk3uScheme(scheme) && units.length === 13) {
      return IA04B_KELOMPOK_PEKERJAAN;
    }
    return [
      {
        kpIndex: 1,
        title: "Kelompok Pekerjaan 1",
        isGenericFallback: true,
        units: units.map((u, idx) => ({ no: idx + 1, code: u.code, title: u.title })),
        aspects: units.map((u, idx) => ({
          kpIndex: 1,
          no: idx + 1,
          unitCode: u.code,
          unitTitle: u.title,
          lingkup: u.title,
          question: `Bagaimana penerapan prosedur dan pengendalian pada unit ${u.title}?`,
          kukRef: `${u.code} — ${u.title}`,
        })),
      },
    ];
  }
  if (!scheme || isAk3uScheme(scheme)) {
    return IA04B_KELOMPOK_PEKERJAAN;
  }
  return [];
}

export function resolveSchemeWrittenQuestions(
  scheme?: SchemeRecord | null,
): SchemeWrittenQuestionSpec[] {
  const configured = scheme?.manifest?.writtenQuestions;
  return Array.isArray(configured) ? configured : [];
}

export function resolveSchemeInterviewQuestions(
  scheme?: SchemeRecord | null,
): SchemeInterviewQuestionSpec[] {
  const configured = scheme?.manifest?.interviewQuestions;
  return Array.isArray(configured) ? configured : [];
}

export function hasGenericFallbackKelompok(scheme?: SchemeRecord | null): boolean {
  return resolveSchemeKelompokPekerjaan(scheme).some((kp) => Boolean(kp.isGenericFallback));
}

export function resolveSchemeDocColumns(scheme?: SchemeRecord | null): string[] {
  const cols = scheme?.manifest?.docColumns;
  if (Array.isArray(cols) && cols.length > 0) {
    return cols;
  }
  return [...DEFAULT_DOC_COLUMNS];
}

export function resolveSchemeBranding(scheme?: SchemeRecord | null): SchemeBrandingConfig {
  const branding = scheme?.manifest?.branding;
  const allowAk3uLogoFallback = !scheme || isAk3uScheme(scheme);
  return {
    leftLogoUrl:
      branding?.leftLogoUrl ||
      (allowAk3uLogoFallback ? "/templates/ak3u/bnsp-logo.png" : undefined),
    leftLogoAlt: branding?.leftLogoAlt || "BNSP",
    rightLogoUrl:
      branding?.rightLogoUrl ||
      (allowAk3uLogoFallback ? "/templates/ak3u/lsp-logo.png" : undefined),
    rightLogoAlt: branding?.rightLogoAlt || (scheme ? `${scheme.code} — LSP` : "LSP Logo"),
  };
}

export function extractSchemeMeta(scheme?: SchemeRecord | null): {
  schemeTitle: string;
  schemeNumber: string;
} {
  if (!scheme) {
    return {
      schemeTitle: "Skema Tersertifikasi (belum dipilih)",
      schemeNumber: "-",
    };
  }
  const match = scheme.name.match(/\((SKM\/[^)]+)\)/i);
  const schemeTitle = scheme.name.replace(/\s*\(SKM\/[^)]+\)/i, "").trim() || scheme.name;
  const schemeNumber = match?.[1]?.trim() || "-";
  return { schemeTitle, schemeNumber };
}

export function normalizeTukType(
  raw?: string | null,
): "sewaktu" | "tempat_kerja" | "mandiri" {
  if (raw === "tempat_kerja" || raw === "mandiri") return raw;
  return "sewaktu";
}

export interface RawDecisionRow {
  unitCode?: string;
  unit_code?: string;
  unitTitle?: string;
  unit_title?: string;
  decision?: string | null;
  assessorNote?: string | null;
  assessor_note?: string | null;
}

export function buildAk02Payload(params: {
  scheme?: SchemeRecord | null;
  schemeTitle: string;
  schemeNumber: string;
  tukType?: string | null;
  assessorName: string;
  assessorRegNo: string;
  assesseeName: string;
  assessmentDate: string;
  decisions: RawDecisionRow[];
  manualOverride?: OverallDecisionOverrideLike | null;
  resolvedOverall?: ResolvedOverallDecision;
  hasDit: boolean;
  hasDitForms?: boolean;
  hasWritten: boolean;
  hasInterview?: boolean;
  signaturePngBytes?: Buffer;
  signatureMimeType?: "image/png" | "image/jpeg";
}): Ak02ExportPayload {
  const decisionList = params.decisions.map((d) => {
    const row = d as unknown as Record<string, unknown>;
    return {
      unitCode: readStringField(row, "unitCode", "unit_code"),
      unitTitle: readStringField(row, "unitTitle", "unit_title"),
      decision: d.decision ?? null,
      note: readStringField(row, "assessorNote", "assessor_note"),
    };
  });
  const decidedList = decisionList.filter(
    (d) => d.decision === "K" || d.decision === "BK",
  );

  const targetUnits = resolveSchemeUnitsList(params.scheme);

  const unitDecisions = targetUnits.map((unitRef) => {
    const lowerOfficial = unitRef.title.toLowerCase();
    const matched = decidedList.find(
      (d) =>
        (unitRef.code && d.unitCode.toLowerCase() === unitRef.code.toLowerCase()) ||
        d.unitTitle.toLowerCase() === lowerOfficial ||
        d.unitTitle.toLowerCase().includes(lowerOfficial.slice(0, 20)),
    );

    const evidenceTypes: Ak02EvidenceType[] = [];
    if (matched) evidenceTypes.push("portofolio");
    if (params.hasWritten) evidenceTypes.push("tertulis");
    if (params.hasDit || params.hasDitForms) evidenceTypes.push("proyek");
    if (params.hasInterview) evidenceTypes.push("pihak_ketiga");

    return {
      unitCode: matched?.unitCode || unitRef.code,
      unitTitle: unitRef.title,
      evidenceTypes,
    };
  });

  const resolved =
    params.resolvedOverall ??
    resolveAssesseeOverallDecision({
      unitDecisions: decisionList,
      totalSchemeUnits: targetUnits.length,
      manualOverride: params.manualOverride,
    });
  const bkDecisions = decidedList.filter((d) => d.decision === "BK");
  const bkFollowUp = bkDecisions
    .map((d) => `${d.unitCode || d.unitTitle}${d.note ? `: ${d.note}` : ""}`)
    .join("; ");

  const followUpNote = resolved.isOverridden
    ? resolved.overrideReason
      ? `Override Manual Asesor: ${resolved.overrideReason}${bkFollowUp ? ` (Unit BK: ${bkFollowUp})` : ""}`
      : bkFollowUp || "Override Manual Asesor"
    : bkFollowUp || (resolved.recommendation === "BK" ? resolved.keterangan : "-");

  let assessorComment: string;
  if (resolved.isOverridden) {
    const verdictWord = resolved.recommendation === "K" ? "Kompeten" : "Belum Kompeten";
    assessorComment = resolved.overrideReason
      ? `Keputusan akhir ditetapkan secara manual oleh asesor (${verdictWord}): ${resolved.overrideReason}`
      : `Keputusan akhir ditetapkan secara manual oleh asesor (${verdictWord}).`;
  } else if (resolved.recommendation === "BK") {
    assessorComment =
      bkDecisions.length > 0
        ? `Terdapat ${bkDecisions.length} unit kompetensi yang memerlukan tindak lanjut asesmen ulang.`
        : `Terdapat hasil Belum Kompeten yang memerlukan tindak lanjut asesmen ulang (${resolved.keterangan}).`;
  } else if (resolved.recommendation === "K") {
    assessorComment =
      "Asesi memenuhi seluruh persyaratan bukti kompetensi sesuai skema sertifikasi.";
  } else if (resolved.decidedCount > 0) {
    assessorComment = `Baru ${resolved.decidedCount} dari ${targetUnits.length} unit kompetensi yang diputuskan — menunggu keputusan unit lainnya.`;
  } else {
    assessorComment = "Belum ada keputusan unit kompetensi yang ditetapkan oleh asesor.";
  }

  return {
    schemeTitle: params.schemeTitle,
    schemeNumber: params.schemeNumber,
    tukType: normalizeTukType(params.tukType),
    assessorName: params.assessorName,
    assessorRegNo: params.assessorRegNo,
    assesseeName: params.assesseeName,
    assessmentDate: params.assessmentDate,
    endDate: params.assessmentDate,
    unitDecisions,
    overallRecommendation: resolved.recommendation,
    decisionSource: resolved.source,
    overrideReason: resolved.overrideReason,
    followUpNote,
    assessorComment,
    signaturePngBytes: params.signaturePngBytes,
    signatureMimeType: params.signatureMimeType,
  };
}

export interface Official04bItemRating {
  kpIndex: number;
  no: number;
  unitCode: string;
  achieved: boolean | null;
  note?: string;
}

export interface Official04bAssessment {
  items: Official04bItemRating[];
  overallRecommendation: "K" | "BK" | null;
  assessorNotes?: string;
  assessedBy?: string;
  assessedAt?: string;
  officialQuestionCount?: number | null;
  decisionRule?: string;
}

export function extractOfficial04bAssessment(
  ditAnalysis?: Record<string, unknown> | null,
): Official04bAssessment {
  const raw = ditAnalysis
    ? readField<Record<string, unknown>>(ditAnalysis, "official04b", "official_04b")
    : undefined;
  if (!raw || typeof raw !== "object") {
    return { items: [], overallRecommendation: null, assessorNotes: "" };
  }

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: Official04bItemRating[] = rawItems
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, idx) => ({
      kpIndex: Number(item.kpIndex ?? 1),
      no: Number(item.no ?? idx + 1),
      unitCode: String(item.unitCode ?? "").trim(),
      achieved: item.achieved === true ? true : item.achieved === false ? false : null,
      note: typeof item.note === "string" ? item.note : undefined,
    }));

  const rawOverall = raw.overallRecommendation;
  const overallRecommendation =
    rawOverall === "K" || rawOverall === "BK" ? rawOverall : null;

  return {
    items,
    overallRecommendation,
    assessorNotes: typeof raw.assessorNotes === "string" ? raw.assessorNotes : "",
    assessedBy: typeof raw.assessedBy === "string" ? raw.assessedBy : undefined,
    assessedAt: typeof raw.assessedAt === "string" ? raw.assessedAt : undefined,
    officialQuestionCount:
      typeof raw.officialQuestionCount === "number" ? raw.officialQuestionCount : null,
    decisionRule: typeof raw.decisionRule === "string" ? raw.decisionRule : undefined,
  };
}

export function hasSavedOfficial04bAssessment(
  assessment: Official04bAssessment,
): boolean {
  return (
    assessment.items.length > 0 ||
    assessment.overallRecommendation !== null ||
    Boolean(assessment.assessedAt) ||
    Boolean(assessment.assessedBy)
  );
}

export type CoverageMatrixStatus = "Terpenuhi" | "Sebagian" | "Belum Dibahas";

export interface Ia04bAiItemProposal {
  kpIndex: number;
  no: number;
  unitCode: string;
  achieved: boolean | null;
  sourceStatus: CoverageMatrixStatus | null;
  evidenceSpan?: string;
  notes?: string;
}

export interface Ia04bAiProposal {
  hasProposal: boolean;
  items: Ia04bAiItemProposal[];
  overallRecommendation: "K" | "BK" | null;
  readinessRecommendation?: "K" | "BK" | null;
  readinessPct: number | null;
  readinessNote: string;
}

export function sanitizeReadinessNote(raw: string): string {
  return raw.replace(
    /\b([Mm])enenangkan(?=\s+(?:persyaratan|kriteria|standar|kompetensi|ketentuan)\b)/g,
    (_, first: string) => (first === "M" ? "Memenuhi" : "memenuhi"),
  );
}

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeMatchText(value: string): string[] {
  return normalizeMatchText(value)
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function parseCoverageStatus(raw: unknown): CoverageMatrixStatus | null {
  if (raw === "Terpenuhi" || raw === "Sebagian" || raw === "Belum Dibahas") {
    return raw;
  }
  return null;
}

function mapCoverageStatusToAchieved(status: CoverageMatrixStatus | null): boolean | null {
  if (status === "Terpenuhi") return true;
  if (status === "Belum Dibahas") return false;
  return null;
}

function kpMatchesText(kp: SchemeKelompokSpec, text: string): boolean {
  const norm = normalizeMatchText(text);
  if (!norm) return false;
  const kpTitleNorm = normalizeMatchText(kp.title);
  if (kpTitleNorm && norm.includes(kpTitleNorm)) return true;
  const kpTokenRe = new RegExp(`(?:kelompok pekerjaan|kp)\\s*0?${kp.kpIndex}\\b`, "i");
  return kpTokenRe.test(text);
}

function matchCoverageRowForAspect(
  aspect: Ia04bAspectSpec,
  kp: SchemeKelompokSpec,
  flatIdx: number,
  totalAspects: number,
  matrixRows: Array<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  if (matrixRows.length === 0) return undefined;

  const unitCodeLower = aspect.unitCode.trim().toLowerCase();
  if (unitCodeLower) {
    const byCode = matrixRows.find((row) => {
      const fp = String(row.focusPoint ?? row.focus_point ?? "").toLowerCase();
      const kpText = String(row.kelompokPekerjaan ?? row.kelompok_pekerjaan ?? "").toLowerCase();
      return fp.includes(unitCodeLower) || kpText.includes(unitCodeLower);
    });
    if (byCode) return byCode;
  }

  const titleNorm = normalizeMatchText(aspect.unitTitle);
  const lingkupNorm = normalizeMatchText(aspect.lingkup);
  const aspectTokens = Array.from(
    new Set([...tokenizeMatchText(aspect.unitTitle), ...tokenizeMatchText(aspect.lingkup)]),
  );

  let bestScore = 0;
  let bestRow: Record<string, unknown> | undefined;
  for (const row of matrixRows) {
    const fpRaw = String(row.focusPoint ?? row.focus_point ?? "");
    const kpRaw = String(row.kelompokPekerjaan ?? row.kelompok_pekerjaan ?? "");
    const combinedNorm = normalizeMatchText(`${fpRaw} ${kpRaw}`);
    if (!combinedNorm) continue;

    let score = 0;
    if (titleNorm && combinedNorm.includes(titleNorm)) {
      score += 100;
    } else if (lingkupNorm && combinedNorm.includes(lingkupNorm)) {
      score += 90;
    } else if (aspectTokens.length > 0) {
      const rowTokens = new Set(tokenizeMatchText(`${fpRaw} ${kpRaw}`));
      const overlap = aspectTokens.filter((t) => rowTokens.has(t)).length;
      if (overlap / aspectTokens.length >= 0.5) {
        score += Math.round((overlap / aspectTokens.length) * 80);
      }
    }

    if (score > 0 && kpMatchesText(kp, kpRaw)) {
      score += 15;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }
  if (bestRow && bestScore > 0) {
    return bestRow;
  }

  if (matrixRows.length === totalAspects) {
    return matrixRows[flatIdx];
  }
  if (matrixRows.length >= totalAspects) {
    const byNo = matrixRows.find((row) => Number(row.no) === flatIdx + 1);
    if (byNo) return byNo;
  }

  const kpMatchedRows = matrixRows.filter((row) =>
    kpMatchesText(kp, String(row.kelompokPekerjaan ?? row.kelompok_pekerjaan ?? "")),
  );
  if (kpMatchedRows.length === 1) {
    return kpMatchedRows[0];
  }

  return undefined;
}

export function buildIa04bAiProposals(params: {
  scheme?: SchemeRecord | null;
  ditAnalysis?: Record<string, unknown> | null;
}): Ia04bAiProposal {
  const kelompokPekerjaan = resolveSchemeKelompokPekerjaan(params.scheme);
  const flatPairs = kelompokPekerjaan.flatMap((kp) =>
    kp.aspects.map((aspect) => ({ kp, aspect })),
  );
  const matrixRows = readArrayField(params.ditAnalysis, "coverageMatrix", "coverage_matrix");
  const readiness = params.ditAnalysis
    ? readField<Record<string, unknown>>(params.ditAnalysis, "readiness", "readiness")
    : undefined;

  const rawRec = readiness?.recommendation;
  const readinessRecommendation: "K" | "BK" | null =
    rawRec === "Kompeten" || rawRec === "K"
      ? "K"
      : rawRec === "Belum Kompeten" || rawRec === "BK"
        ? "BK"
        : null;

  const rawPct = readiness?.readiness_pct ?? readiness?.readinessPct;
  const parsedPct = typeof rawPct === "number" ? rawPct : Number(rawPct);
  const readinessPct =
    rawPct !== undefined &&
    rawPct !== null &&
    rawPct !== "" &&
    Number.isFinite(parsedPct) &&
    parsedPct >= 0 &&
    parsedPct <= 100
      ? parsedPct
      : null;

  const readinessNote = sanitizeReadinessNote(
    readStringField(
      readiness,
      "readinessRecommendationNote",
      "readiness_recommendation_note",
    ),
  );

  const items: Ia04bAiItemProposal[] = flatPairs.map(({ kp, aspect }, flatIdx) => {
    const row = matchCoverageRowForAspect(
      aspect,
      kp,
      flatIdx,
      flatPairs.length,
      matrixRows,
    );
    const sourceStatus = row ? parseCoverageStatus(row.status) : null;
    const evidenceSpan = row
      ? readStringField(row, "evidenceSpan", "evidence_span")
      : "";
    const notes = row ? readStringField(row, "notes", "notes") : "";

    return {
      kpIndex: kp.kpIndex,
      no: aspect.no,
      unitCode: aspect.unitCode,
      achieved: mapCoverageStatusToAchieved(sourceStatus),
      sourceStatus,
      ...(evidenceSpan ? { evidenceSpan } : {}),
      ...(notes ? { notes } : {}),
    };
  });

  // Strict 100% pass rule: K only if ALL items are Ya; any Tidak -> BK; any Belum -> null (undecided)
  let overallRecommendation: "K" | "BK" | null = null;
  if (items.length > 0) {
    if (items.some((item) => item.achieved === false)) {
      overallRecommendation = "BK";
    } else if (items.every((item) => item.achieved === true)) {
      overallRecommendation = "K";
    }
  }

  const hasProposal =
    matrixRows.length > 0 || readinessRecommendation !== null || readinessPct !== null;

  return {
    hasProposal,
    items,
    overallRecommendation,
    readinessRecommendation,
    readinessPct,
    readinessNote,
  };
}

export function buildIa04bPayload(params: {
  scheme?: SchemeRecord | null;
  schemeTitle: string;
  schemeNumber: string;
  tukType?: string | null;
  assessorName: string;
  assessorRegNo: string;
  assesseeName: string;
  assessmentDate: string;
  ditAnalysis?: Record<string, unknown> | null;
  decisions: RawDecisionRow[];
  manualOverride?: OverallDecisionOverrideLike | null;
  signaturePngBytes?: Buffer;
  signatureMimeType?: "image/png" | "image/jpeg";
}): Ia04bExportPayload {
  const kelompokPekerjaan = resolveSchemeKelompokPekerjaan(params.scheme);
  const flatAspects = kelompokPekerjaan.flatMap((kp) => kp.aspects);
  const targetUnits = resolveSchemeUnitsList(params.scheme);
  const savedOfficial04b = extractOfficial04bAssessment(params.ditAnalysis);

  const decisionMap = new Map<string, string>();
  for (const d of params.decisions) {
    if (d.decision !== "K" && d.decision !== "BK") continue;
    const title = readStringField(d as unknown as Record<string, unknown>, "unitTitle", "unit_title").toLowerCase();
    if (title) decisionMap.set(title, d.decision);
  }

  const hasExplicit04bItems = savedOfficial04b.items.length > 0;
  const itemAchievedFlags: Array<boolean | null> = flatAspects.map((aspect, idx) => {
    if (hasExplicit04bItems) {
      const matchedItem =
        savedOfficial04b.items.find(
          (item) => item.kpIndex === aspect.kpIndex && item.no === aspect.no,
        ) ??
        (aspect.unitCode
          ? savedOfficial04b.items.find(
              (item) => item.unitCode.toLowerCase() === aspect.unitCode.toLowerCase(),
            )
          : undefined) ??
        savedOfficial04b.items[idx];
      return matchedItem ? matchedItem.achieved : null;
    }

    // Fallback strictly to explicit assessor unit decisions (never AI coverageMatrix)
    const dec = decisionMap.get(aspect.unitTitle.toLowerCase());
    if (dec === "K") return true;
    if (dec === "BK") return false;
    return null;
  });

  const resolvedOverall = resolveAssesseeOverallDecision({
    unitDecisions: params.decisions,
    totalSchemeUnits: targetUnits.length,
    manualOverride: params.manualOverride,
  });

  let overallRecommendation: "K" | "BK" | null;
  if (resolvedOverall.isOverridden) {
    overallRecommendation = resolvedOverall.recommendation;
  } else if (savedOfficial04b.overallRecommendation) {
    overallRecommendation = savedOfficial04b.overallRecommendation;
  } else if (resolvedOverall.recommendation === "BK" || resolvedOverall.recommendation === "K") {
    overallRecommendation = resolvedOverall.recommendation;
  } else {
    overallRecommendation = null;
  }

  return {
    schemeCode: params.scheme?.code,
    schemeTitle: params.schemeTitle,
    schemeNumber: params.schemeNumber,
    tukType: normalizeTukType(params.tukType),
    assessorName: params.assessorName,
    assessorRegNo: params.assessorRegNo,
    assesseeName: params.assesseeName,
    assessmentDate: params.assessmentDate,
    kelompokPekerjaan,
    itemAchievedFlags,
    overallRecommendation,
    signaturePngBytes: params.signaturePngBytes,
    signatureMimeType: params.signatureMimeType,
  };
}

export function buildIa04aPayload(params: {
  schemeTitle: string;
  schemeNumber: string;
  tukType?: string | null;
  assessorName: string;
  assessorRegNo: string;
  assesseeName: string;
  assessmentDate: string;
  ditAnalysis?: Record<string, unknown> | null;
}): Ia04aExportPayload {
  const readinessRaw = params.ditAnalysis
    ? readField<{ recommendation?: string }>(params.ditAnalysis, "readiness", "readiness")
    : undefined;
  const questionBankRaw = readArrayField(
    params.ditAnalysis,
    "questionBank",
    "question_bank",
  );
  const rawOutput = readField<{ frIa04aText?: string }>(
    params.ditAnalysis,
    "rawOutput",
    "raw_output",
  );

  const modelAnswers = Array.isArray(questionBankRaw)
    ? questionBankRaw.map((q) => ({
        no: readStringField(q, "no", "no") || String(q.no ?? ""),
        question: readStringField(q, "question", "question"),
        keyPoints: Array.isArray(q.modelAnswerKeyPoints)
          ? q.modelAnswerKeyPoints.map((p: unknown) => String(p ?? ""))
          : [],
      }))
    : [];

  return {
    schemeTitle: params.schemeTitle,
    schemeNumber: params.schemeNumber,
    tukType: normalizeTukType(params.tukType),
    assessorName: params.assessorName,
    assessorRegNo: params.assessorRegNo,
    assesseeName: params.assesseeName,
    assessmentDate: params.assessmentDate,
    ditExtractedText: rawOutput?.frIa04aText ?? undefined,
    modelAnswers,
    readiness: readinessRaw?.recommendation ?? null,
  };
}

export type WrittenItemVerdict = "Benar" | "Sebagian" | "Salah";

export interface Official06cItemRating {
  questionNo: number;
  answerText: string;
  achieved: boolean | null;
  note?: string;
}

export interface Official06cAssessment {
  items: Official06cItemRating[];
  overallAchieved: boolean | null;
  feedbackDetail?: string;
  assessedBy?: string;
  assessedAt?: string;
}

export interface Ia06cAiItemProposal {
  questionNo: number;
  answerText: string;
  achieved: boolean | null;
  sourceVerdict: WrittenItemVerdict | null;
  masterSpan?: string;
  explanation?: string;
}

export interface Ia06cAiProposal {
  hasProposal: boolean;
  items: Ia06cAiItemProposal[];
  overallAchieved: boolean | null;
  feedbackDetail: string;
}

function resolveIa06cSlotCount(
  scheme?: SchemeRecord | null,
  itemCount = 0,
): number {
  const configuredCount = Math.max(
    scheme?.manifest?.questionCounts?.written06aCount ?? 0,
    scheme?.manifest?.writtenQuestions?.length ?? 0,
  );
  return scheme
    ? Math.max(configuredCount || itemCount || 1, itemCount)
    : Math.max(13, itemCount);
}

function mapWrittenVerdictToAchieved(verdict: WrittenItemVerdict | null): boolean | null {
  if (verdict === "Benar") return true;
  if (verdict === "Salah") return false;
  return null;
}

function parseWrittenVerdict(raw: unknown): WrittenItemVerdict | null {
  if (raw === "Benar" || raw === "Sebagian" || raw === "Salah") {
    return raw;
  }
  return null;
}

export function extractOfficial06cAssessment(
  writtenGrading?: Record<string, unknown> | null,
): Official06cAssessment {
  if (!writtenGrading || typeof writtenGrading !== "object") {
    return { items: [], overallAchieved: null, feedbackDetail: "" };
  }

  const directRaw = readField<Record<string, unknown>>(
    writtenGrading,
    "official06c",
    "official_06c",
  );
  const formMapping = readField<Record<string, unknown>>(
    writtenGrading,
    "formMapping",
    "form_mapping",
  );
  const raw =
    directRaw && typeof directRaw === "object"
      ? directRaw
      : formMapping &&
          typeof formMapping === "object" &&
          formMapping.official06c &&
          typeof formMapping.official06c === "object"
        ? (formMapping.official06c as Record<string, unknown>)
        : undefined;

  if (!raw || typeof raw !== "object") {
    return { items: [], overallAchieved: null, feedbackDetail: "" };
  }

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: Official06cItemRating[] = rawItems
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, idx) => ({
      questionNo: Number(item.questionNo ?? idx + 1),
      answerText: typeof item.answerText === "string" ? item.answerText : "",
      achieved: item.achieved === true ? true : item.achieved === false ? false : null,
      note: typeof item.note === "string" ? item.note : undefined,
    }));

  const overallAchieved =
    raw.overallAchieved === true
      ? true
      : raw.overallAchieved === false
        ? false
        : null;

  const fallbackConfirmedBy = readField<unknown>(
    writtenGrading,
    "confirmedBy",
    "confirmed_by",
  );
  const fallbackConfirmedAt = readField<unknown>(
    writtenGrading,
    "confirmedAt",
    "confirmed_at",
  );
  const assessedBy =
    typeof raw.assessedBy === "string" && raw.assessedBy.trim()
      ? raw.assessedBy
      : typeof fallbackConfirmedBy === "string" && fallbackConfirmedBy.trim()
        ? fallbackConfirmedBy
        : undefined;
  const assessedAt =
    typeof raw.assessedAt === "string" && raw.assessedAt.trim()
      ? raw.assessedAt
      : fallbackConfirmedAt instanceof Date
        ? fallbackConfirmedAt.toISOString()
        : typeof fallbackConfirmedAt === "string" && fallbackConfirmedAt.trim()
          ? fallbackConfirmedAt
          : undefined;

  return {
    items,
    overallAchieved,
    feedbackDetail: typeof raw.feedbackDetail === "string" ? raw.feedbackDetail : "",
    assessedBy,
    assessedAt,
  };
}

export function hasSavedOfficial06cAssessment(
  assessment: Official06cAssessment,
): boolean {
  return (
    assessment.items.length > 0 ||
    assessment.overallAchieved !== null ||
    Boolean(assessment.assessedAt) ||
    Boolean(assessment.assessedBy)
  );
}

export function buildIa06cAiProposals(params: {
  scheme?: SchemeRecord | null;
  writtenGrading?: Record<string, unknown> | null;
}): Ia06cAiProposal {
  const itemVerdicts = params.writtenGrading
    ? readField<
        Array<{
          questionNo: number;
          verdict: string;
          masterSpan?: string;
          studentSpan?: string;
          explanation?: string;
        }>
      >(params.writtenGrading, "itemVerdicts", "item_verdicts") ?? []
    : [];

  const vatmRecs = params.writtenGrading
    ? readField<
        Array<{
          unitCode: string;
          unitTitle: string;
          recommendation: "K" | "BK";
        }>
      >(params.writtenGrading, "vatmUnitRecommendations", "vatm_unit_recommendations") ?? []
    : [];

  const sorted = [...itemVerdicts].sort((a, b) => a.questionNo - b.questionNo);
  const slotCount = resolveIa06cSlotCount(params.scheme, sorted.length);

  const items: Ia06cAiItemProposal[] = Array.from({ length: slotCount }).map((_, idx) => {
    const qNo = idx + 1;
    const item = sorted.find((v) => v.questionNo === qNo) ?? sorted[idx];
    if (!item) {
      return {
        questionNo: qNo,
        answerText: "",
        achieved: null,
        sourceVerdict: null,
      };
    }

    const sourceVerdict = parseWrittenVerdict(item.verdict);
    const baseText = item.studentSpan?.trim() || item.explanation?.trim() || "";
    const answerText =
      sourceVerdict === "Sebagian" && baseText
        ? `[Sebagian] ${baseText}`
        : baseText;
    const masterSpan = item.masterSpan?.trim() || "";
    const explanation = item.explanation?.trim() || "";

    return {
      questionNo: qNo,
      answerText,
      achieved: mapWrittenVerdictToAchieved(sourceVerdict),
      sourceVerdict,
      ...(masterSpan ? { masterSpan } : {}),
      ...(explanation ? { explanation } : {}),
    };
  });

  // Strict 100% pass rule across ALL slots: BK if any BK unit or any Tidak; K only if all slots are Ya
  const bkUnits = vatmRecs.filter((u) => u.recommendation === "BK");
  let overallAchieved: boolean | null = null;
  if (sorted.length > 0 || vatmRecs.length > 0) {
    if (bkUnits.length > 0 || items.some((item) => item.achieved === false)) {
      overallAchieved = false;
    } else if (items.length > 0 && items.every((item) => item.achieved === true)) {
      overallAchieved = true;
    } else {
      overallAchieved = null;
    }
  }

  const feedbackDetail =
    bkUnits.length > 0
      ? bkUnits.map((u) => `${u.unitCode} (${u.unitTitle})`).join(", ")
      : "";

  return {
    hasProposal: sorted.length > 0 || vatmRecs.length > 0,
    items,
    overallAchieved,
    feedbackDetail,
  };
}

export function buildIa06cPayload(params: {
  scheme?: SchemeRecord | null;
  schemeTitle: string;
  schemeNumber: string;
  tukType?: string | null;
  assessorName: string;
  assessorRegNo: string;
  assesseeName: string;
  assessmentDate: string;
  writtenGrading?: Record<string, unknown> | null;
  signaturePngBytes?: Buffer;
  signatureMimeType?: "image/png" | "image/jpeg";
}): Ia06cExportPayload {
  const savedOfficial06c = extractOfficial06cAssessment(params.writtenGrading);
  const hasSaved = hasSavedOfficial06cAssessment(savedOfficial06c);

  const itemVerdicts = params.writtenGrading
    ? readField<
        Array<{
          questionNo: number;
          verdict: "Benar" | "Sebagian" | "Salah";
          studentSpan?: string;
          explanation?: string;
        }>
      >(params.writtenGrading, "itemVerdicts", "item_verdicts") ?? []
    : [];

  const sorted = [...itemVerdicts].sort((a, b) => a.questionNo - b.questionNo);
  const maxItemCount = Math.max(sorted.length, savedOfficial06c.items.length);
  const slotCount = resolveIa06cSlotCount(params.scheme, maxItemCount);

  const answers = Array.from({ length: slotCount }).map((_, idx) => {
    const qNo = idx + 1;
    const aiItem = sorted.find((v) => v.questionNo === qNo) ?? sorted[idx];
    const baseText = aiItem
      ? aiItem.studentSpan?.trim() || aiItem.explanation?.trim() || ""
      : "";
    const aiAnswerText =
      aiItem?.verdict === "Sebagian" && baseText
        ? `[Sebagian] ${baseText}`
        : baseText;

    if (hasSaved) {
      const savedItem =
        savedOfficial06c.items.find((s) => s.questionNo === qNo) ??
        savedOfficial06c.items[idx];
      return {
        questionNo: qNo,
        answerText: savedItem?.answerText?.trim() ? savedItem.answerText : aiAnswerText,
        achieved: savedItem ? savedItem.achieved : null,
      };
    }

    // Official blanko & DOCX remain neutral (achieved: null) until assessor explicitly saves
    return {
      questionNo: qNo,
      answerText: aiAnswerText,
      achieved: null,
    };
  });

  const savedFeedback = savedOfficial06c.feedbackDetail?.trim() || undefined;

  return {
    schemeTitle: params.schemeTitle,
    schemeNumber: params.schemeNumber,
    tukType: normalizeTukType(params.tukType),
    assessorName: params.assessorName,
    assessorRegNo: params.assessorRegNo,
    assesseeName: params.assesseeName,
    assessmentDate: params.assessmentDate,
    durationText: "60 Menit",
    answers,
    overallAchieved: hasSaved ? savedOfficial06c.overallAchieved : null,
    feedbackDetail: hasSaved ? savedFeedback : undefined,
    signaturePngBytes: params.signaturePngBytes,
    signatureMimeType: params.signatureMimeType,
  };
}
