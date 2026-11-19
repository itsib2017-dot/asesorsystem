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
    return kps.flatMap((kp) => kp.units.map((u) => ({ code: u.code, title: u.title })));
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
    : bkFollowUp || "-";

  let assessorComment: string;
  if (resolved.isOverridden) {
    const verdictWord = resolved.recommendation === "K" ? "Kompeten" : "Belum Kompeten";
    assessorComment = resolved.overrideReason
      ? `Keputusan akhir ditetapkan secara manual oleh asesor (${verdictWord}): ${resolved.overrideReason}`
      : `Keputusan akhir ditetapkan secara manual oleh asesor (${verdictWord}).`;
  } else if (resolved.recommendation === "BK") {
    assessorComment = `Terdapat ${bkDecisions.length} unit kompetensi yang memerlukan tindak lanjut asesmen ulang.`;
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
  const matrixRaw = params.ditAnalysis
    ? readField<Array<{ focusPoint?: string; status?: string }>>(
        params.ditAnalysis,
        "coverageMatrix",
        "coverage_matrix",
      )
    : undefined;
  const readinessRaw = params.ditAnalysis
    ? readField<{ recommendation?: string }>(params.ditAnalysis, "readiness", "readiness")
    : undefined;

  const decisionMap = new Map<string, string>();
  for (const d of params.decisions) {
    if (d.decision !== "K" && d.decision !== "BK") continue;
    const title = readStringField(d as unknown as Record<string, unknown>, "unitTitle", "unit_title").toLowerCase();
    if (title) decisionMap.set(title, d.decision);
  }

  const itemAchievedFlags: Array<boolean | null> = flatAspects.map((aspect, idx) => {
    const rowMatch = Array.isArray(matrixRaw) ? matrixRaw[idx] : undefined;
    if (rowMatch?.status === "Terpenuhi") return true;
    if (rowMatch?.status === "Belum Dibahas") return false;
    const dec = decisionMap.get(aspect.unitTitle.toLowerCase());
    if (dec === "K") return true;
    if (dec === "BK") return false;
    if (rowMatch?.status === "Sebagian") return false;
    return null;
  });

  const resolvedOverall = resolveAssesseeOverallDecision({
    unitDecisions: params.decisions,
    totalSchemeUnits: targetUnits.length,
    manualOverride: params.manualOverride,
  });

  const hasMatrix = Array.isArray(matrixRaw) && matrixRaw.length > 0;
  const allUnsetWithCompetentDit =
    hasMatrix &&
    itemAchievedFlags.every((v) => v === null) &&
    readinessRaw?.recommendation === "Kompeten" &&
    resolvedOverall.bkCount === 0;
  const resolvedFlags = allUnsetWithCompetentDit
    ? itemAchievedFlags.map(() => true)
    : itemAchievedFlags;

  let overallRecommendation: "K" | "BK" | null;
  if (resolvedOverall.isOverridden) {
    overallRecommendation = resolvedOverall.recommendation;
  } else if (resolvedOverall.recommendation === "BK") {
    overallRecommendation = "BK";
  } else if (resolvedOverall.recommendation === "K") {
    overallRecommendation = "K";
  } else if (hasMatrix) {
    if (
      readinessRaw?.recommendation === "Belum Kompeten" &&
      resolvedFlags.some((f) => f === false)
    ) {
      overallRecommendation = "BK";
    } else if (resolvedFlags.length > 0 && resolvedFlags.every((f) => f === true)) {
      overallRecommendation = "K";
    } else if (
      readinessRaw?.recommendation === "Kompeten" &&
      resolvedOverall.decidedCount > 0 &&
      resolvedOverall.bkCount === 0
    ) {
      overallRecommendation = "K";
    } else {
      overallRecommendation = null;
    }
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
    itemAchievedFlags: resolvedFlags,
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
  const configuredCount = Math.max(
    params.scheme?.manifest?.questionCounts?.written06aCount ?? 0,
    params.scheme?.manifest?.writtenQuestions?.length ?? 0,
  );
  const slotCount = params.scheme
    ? Math.max(configuredCount || sorted.length || 1, sorted.length)
    : Math.max(13, sorted.length);
  const answers = Array.from({ length: slotCount }).map((_, idx) => {
    const item = sorted.find((v) => v.questionNo === idx + 1) ?? sorted[idx];
    if (!item) {
      return {
        questionNo: idx + 1,
        answerText: "",
        achieved: null,
      };
    }
    const baseText = item.studentSpan?.trim() || item.explanation?.trim() || "";
    const answerText =
      item.verdict === "Sebagian" && baseText
        ? `[Sebagian] ${baseText}`
        : baseText;
    return {
      questionNo: idx + 1,
      answerText,
      achieved: item.verdict === "Benar",
    };
  });

  const bkUnits = vatmRecs.filter((u) => u.recommendation === "BK");
  const overallAchieved: boolean | null =
    sorted.length === 0
      ? null
      : bkUnits.length === 0 && !sorted.some((v) => v.verdict === "Salah");

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
    overallAchieved,
    feedbackDetail:
      bkUnits.length > 0
        ? bkUnits.map((u) => `${u.unitCode} (${u.unitTitle})`).join(", ")
        : undefined,
    signaturePngBytes: params.signaturePngBytes,
    signatureMimeType: params.signatureMimeType,
  };
}
