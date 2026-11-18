import type {
  Ak02EvidenceType,
  Ak02ExportPayload,
  Ia04bExportPayload,
  Ia06cExportPayload,
} from "@/services/export";
import type { SchemeRecord } from "@/repositories/schemes.repository";

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

export interface Ia04bKelompokSpec {
  kpIndex: number;
  title: string;
  units: Array<{ no: number; code: string; title: string }>;
  aspects: Ia04bAspectSpec[];
}

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

export function getFallbackAk3uUnits(): Array<{ code: string; title: string }> {
  return IA04B_KELOMPOK_PEKERJAAN.flatMap((kp) =>
    kp.units.map((u) => ({ code: u.code, title: u.title })),
  );
}

export function extractSchemeMeta(scheme?: SchemeRecord | null): {
  schemeTitle: string;
  schemeNumber: string;
} {
  if (!scheme) {
    return {
      schemeTitle: "AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM",
      schemeNumber: "SKM/2037/00013/2/2021/1",
    };
  }
  const match = scheme.name.match(/\((SKM\/[^)]+)\)/i);
  const schemeTitle = scheme.name.replace(/\s*\(SKM\/[^)]+\)/i, "").trim() || scheme.name;
  const schemeNumber = match?.[1]?.trim() || scheme.manifest?.decisionRuleRef || "-";
  return { schemeTitle, schemeNumber };
}

export function normalizeTukType(
  raw?: string | null,
): "sewaktu" | "tempat_kerja" | "mandiri" {
  if (raw === "tempat_kerja" || raw === "mandiri") return raw;
  return "sewaktu";
}

function normalizeStr(s?: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function getField<T = unknown>(row: Record<string, unknown>, camel: string, snake: string): T | undefined {
  return (row[camel] ?? row[snake]) as T | undefined;
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
  schemeTitle: string;
  schemeNumber: string;
  tukType?: string | null;
  assessorName: string;
  assessorRegNo: string;
  assesseeName: string;
  assessmentDate: string;
  decisions: RawDecisionRow[];
  hasDit: boolean;
  hasWritten: boolean;
  hasInterview?: boolean;
  signaturePngBytes?: Buffer;
  signatureMimeType?: "image/png" | "image/jpeg";
}): Ak02ExportPayload {
  const decisionList = params.decisions.map((d) => ({
    unitCode: normalizeStr(d.unitCode ?? d.unit_code),
    unitTitle: normalizeStr(d.unitTitle ?? d.unit_title),
    decision: d.decision ?? null,
    note: normalizeStr(d.assessorNote ?? d.assessor_note),
  }));

  const unitDecisions = AK3U_OFFICIAL_UNITS.map((officialTitle) => {
    const lowerOfficial = officialTitle.toLowerCase();
    const matched = decisionList.find(
      (d) =>
        d.unitTitle.toLowerCase() === lowerOfficial ||
        d.unitTitle.toLowerCase().includes(lowerOfficial.slice(0, 20)),
    );

    const evidenceTypes: Ak02EvidenceType[] = ["portofolio"];
    if (params.hasWritten) evidenceTypes.push("tertulis");
    if (params.hasDit) evidenceTypes.push("proyek");
    if (params.hasInterview) evidenceTypes.push("pihak_ketiga");

    return {
      unitCode: matched?.unitCode,
      unitTitle: officialTitle,
      evidenceTypes:
        matched || params.hasDit || params.hasWritten || params.hasInterview
          ? evidenceTypes
          : [],
    };
  });

  const bkDecisions = decisionList.filter((d) => d.decision === "BK");
  const overallRecommendation: "K" | "BK" = bkDecisions.length > 0 ? "BK" : "K";
  const followUpNote =
    bkDecisions.length > 0
      ? bkDecisions
          .map((d) => `${d.unitCode || d.unitTitle}${d.note ? `: ${d.note}` : ""}`)
          .join("; ")
      : "-";
  const assessorComment =
    bkDecisions.length > 0
      ? `Terdapat ${bkDecisions.length} unit kompetensi yang memerlukan tindak lanjut asesmen ulang.`
      : "Asesi memenuhi seluruh persyaratan bukti kompetensi sesuai skema sertifikasi.";

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
    overallRecommendation,
    followUpNote,
    assessorComment,
    signaturePngBytes: params.signaturePngBytes,
    signatureMimeType: params.signatureMimeType,
  };
}

export function buildIa04bPayload(params: {
  schemeTitle: string;
  schemeNumber: string;
  tukType?: string | null;
  assessorName: string;
  assessorRegNo: string;
  assesseeName: string;
  assessmentDate: string;
  ditAnalysis?: Record<string, unknown> | null;
  decisions: RawDecisionRow[];
  signaturePngBytes?: Buffer;
  signatureMimeType?: "image/png" | "image/jpeg";
}): Ia04bExportPayload {
  const flatAspects = IA04B_KELOMPOK_PEKERJAAN.flatMap((kp) => kp.aspects);
  const matrixRaw = params.ditAnalysis
    ? getField<Array<{ focusPoint?: string; status?: string }>>(
        params.ditAnalysis,
        "coverageMatrix",
        "coverage_matrix",
      )
    : undefined;
  const readinessRaw = params.ditAnalysis
    ? getField<{ recommendation?: string }>(params.ditAnalysis, "readiness", "readiness")
    : undefined;

  const decisionMap = new Map<string, string>();
  for (const d of params.decisions) {
    const title = normalizeStr(d.unitTitle ?? d.unit_title).toLowerCase();
    if (title && d.decision) decisionMap.set(title, d.decision);
  }

  const itemAchievedFlags = flatAspects.map((aspect, idx) => {
    const rowMatch = Array.isArray(matrixRaw) ? matrixRaw[idx] : undefined;
    if (rowMatch?.status === "Terpenuhi") return true;
    if (rowMatch?.status === "Belum Dibahas") return false;
    const dec = decisionMap.get(aspect.unitTitle.toLowerCase());
    if (dec === "K") return true;
    if (dec === "BK") return false;
    if (rowMatch?.status === "Sebagian") return false;
    return false;
  });

  const anyBk = params.decisions.some((d) => d.decision === "BK");
  const allUnset =
    itemAchievedFlags.every((v) => !v) &&
    readinessRaw?.recommendation === "Kompeten" &&
    !anyBk;
  const resolvedFlags = allUnset ? itemAchievedFlags.map(() => true) : itemAchievedFlags;
  const overallRecommendation: "K" | "BK" =
    anyBk || (readinessRaw?.recommendation === "Belum Kompeten" && resolvedFlags.some((f) => !f))
      ? "BK"
      : resolvedFlags.every(Boolean)
        ? "K"
        : params.decisions.length > 0 && !anyBk
          ? "K"
          : "BK";

  return {
    schemeTitle: params.schemeTitle,
    schemeNumber: params.schemeNumber,
    tukType: normalizeTukType(params.tukType),
    assessorName: params.assessorName,
    assessorRegNo: params.assessorRegNo,
    assesseeName: params.assesseeName,
    assessmentDate: params.assessmentDate,
    itemAchievedFlags: resolvedFlags,
    overallRecommendation,
    signaturePngBytes: params.signaturePngBytes,
    signatureMimeType: params.signatureMimeType,
  };
}

export function buildIa06cPayload(params: {
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
    ? getField<
        Array<{
          questionNo: number;
          verdict: "Benar" | "Sebagian" | "Salah";
          studentSpan?: string;
          explanation?: string;
        }>
      >(params.writtenGrading, "itemVerdicts", "item_verdicts") ?? []
    : [];

  const vatmRecs = params.writtenGrading
    ? getField<
        Array<{
          unitCode: string;
          unitTitle: string;
          recommendation: "K" | "BK";
        }>
      >(params.writtenGrading, "vatmUnitRecommendations", "vatm_unit_recommendations") ?? []
    : [];

  const sorted = [...itemVerdicts].sort((a, b) => a.questionNo - b.questionNo);
  const answers = Array.from({ length: Math.max(13, sorted.length) }).map((_, idx) => {
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
  const overallAchieved =
    sorted.length > 0 &&
    bkUnits.length === 0 &&
    !sorted.some((v) => v.verdict === "Salah");

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
