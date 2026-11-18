export const DEFAULT_SIMILARITY_THRESHOLDS = {
  exact: 0.9,
  near: 0.75,
  partial: 0.5,
} as const;

export interface SimilarityMetrics {
  jaccardScore: number;
  tfidfCosine: number;
  sharedSpans: string[];
  flagLevel: "exact" | "near" | "partial" | "clean";
  qualitativeStatus: "Bersih" | "Waspada";
}

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function makeNgrams(tokens: string[], n = 3): Set<string> {
  const grams = new Set<string>();
  if (tokens.length < n) {
    if (tokens.length > 0) grams.add(tokens.join(" "));
    return grams;
  }
  for (let i = 0; i <= tokens.length - n; i++) {
    grams.add(tokens.slice(i, i + n).join(" "));
  }
  return grams;
}

export function computeJaccardNgram(a: string, b: string, n = 3): {
  score: number;
  sharedSpans: string[];
} {
  const gramsA = makeNgrams(tokenizeWords(a), n);
  const gramsB = makeNgrams(tokenizeWords(b), n);

  if (gramsA.size === 0 || gramsB.size === 0) {
    return { score: 0, sharedSpans: [] };
  }

  const shared: string[] = [];
  for (const g of gramsA) {
    if (gramsB.has(g)) shared.push(g);
  }

  const unionSize = gramsA.size + gramsB.size - shared.length;
  const score = unionSize > 0 ? Number((shared.length / unionSize).toFixed(4)) : 0;

  return {
    score,
    sharedSpans: shared.slice(0, 10),
  };
}

export function computeTfIdfCosine(a: string, b: string): number {
  const tokA = tokenizeWords(a);
  const tokB = tokenizeWords(b);
  if (tokA.length === 0 || tokB.length === 0) return 0;

  const vocab = new Set([...tokA, ...tokB]);
  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();

  for (const t of tokA) freqA.set(t, (freqA.get(t) ?? 0) + 1);
  for (const t of tokB) freqB.set(t, (freqB.get(t) ?? 0) + 1);

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const term of vocab) {
    const df = (freqA.has(term) ? 1 : 0) + (freqB.has(term) ? 1 : 0);
    const idf = Math.log(3 / (1 + df)) + 1;
    const wA = ((freqA.get(term) ?? 0) / tokA.length) * idf;
    const wB = ((freqB.get(term) ?? 0) / tokB.length) * idf;

    dot += wA * wB;
    magA += wA * wA;
    magB += wB * wB;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? Number((dot / denom).toFixed(4)) : 0;
}

export function evaluateSimilarityPair(
  textA: string,
  textB: string,
  thresholds: { exact: number; near: number; partial: number },
): SimilarityMetrics {
  const { score: jaccardScore, sharedSpans } = computeJaccardNgram(textA, textB, 3);
  const tfidfCosine = computeTfIdfCosine(textA, textB);
  const combined = Math.max(jaccardScore, tfidfCosine);

  let flagLevel: SimilarityMetrics["flagLevel"] = "clean";
  if (combined >= thresholds.exact) flagLevel = "exact";
  else if (combined >= thresholds.near) flagLevel = "near";
  else if (combined >= thresholds.partial) flagLevel = "partial";

  return {
    jaccardScore,
    tfidfCosine,
    sharedSpans,
    flagLevel,
    qualitativeStatus: flagLevel === "clean" ? "Bersih" : "Waspada",
  };
}

export function renderCombinedWrittenReportMarkdown(params: {
  batchName: string;
  schemeName: string;
  thresholds?: { exact: number; near: number; partial: number };
  assessees: Array<{
    assesseeId: string;
    realName: string;
    verdicts: Array<{ questionNo: number; verdict: string; explanation: string }>;
    ringkasanKesalahan: number[];
    plagiarismStatus: "Bersih" | "Waspada";
    plagiarismReasoning: string;
  }>;
  flaggedPairs: Array<{
    assesseeAName: string;
    assesseeAId: string;
    assesseeBName: string;
    assesseeBId: string;
    jaccardScore: number;
    tfidfCosine: number;
    sharedSpans: string[];
    verdict: string;
  }>;
}): string {
  const th = params.thresholds ?? DEFAULT_SIMILARITY_THRESHOLDS;
  const thresholdLabel = `Exact >= ${th.exact.toFixed(2)} (${Math.round(th.exact * 100)}%) | Near (Hampir Sama) >= ${th.near.toFixed(2)} (${Math.round(th.near * 100)}%) | Parsial >= ${th.partial.toFixed(2)} (${Math.round(th.partial * 100)}%)`;

  const lines: string[] = [
    `# Laporan Gabungan Penilaian Tertulis & Kemiripan`,
    ``,
    `- **Batch:** ${params.batchName}`,
    `- **Skema:** ${params.schemeName}`,
    `- **Ambang Batas Deteksi:** ${thresholdLabel}`,
    `- **Catatan:** Dokumen ini bersifat rekomendasi AI dan memerlukan konfirmasi asesor. Kemiripan adalah indikator peninjauan, bukan keputusan otomatis.`,
    ``,
    `## 1. Ringkasan Penilaian Per Asesi`,
    ``,
  ];

  for (const a of params.assessees) {
    lines.push(`### ${a.realName} (ID: ${a.assesseeId})`);
    lines.push(`- **Ringkasan Kesalahan (No. Soal):** ${a.ringkasanKesalahan.length > 0 ? a.ringkasanKesalahan.join(", ") : "Tidak ada"}`);
    lines.push(`- **Status Analisis Kemiripan:** **${a.plagiarismStatus}** — ${a.plagiarismReasoning}`);
    lines.push(``);
    lines.push(`| No | Putusan | Penjelasan (Bahasa Indonesia) |`);
    lines.push(`|---|---|---|`);
    for (const v of a.verdicts) {
      lines.push(`| ${v.questionNo} | ${v.verdict} | ${v.explanation.replace(/\|/g, "\\|")} |`);
    }
    lines.push(``);
  }

  lines.push(`## 2. Laporan Analisis Kemiripan Antar Asesi`);
  lines.push(``);
  if (params.flaggedPairs.length === 0) {
    lines.push(`Tidak ditemukan pasangan dengan tingkat kemiripan di atas ambang batas.`);
  } else {
    lines.push(`| Asesi A | Asesi B | Skor Jaccard | Cosine TF-IDF | Status |`);
    lines.push(`|---|---|---|---|---|`);
    for (const p of params.flaggedPairs) {
      lines.push(
        `| ${p.assesseeAName} (${p.assesseeAId}) | ${p.assesseeBName} (${p.assesseeBId}) | ${p.jaccardScore} | ${p.tfidfCosine} | ${p.verdict} |`,
      );
    }
  }

  return lines.join("\n");
}
