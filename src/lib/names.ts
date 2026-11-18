/**
 * Deterministic name normalisation and similarity scoring (ADR-0005).
 * KTP is ALWAYS the certificate-name authority (D6).
 * Normalisation is strictly for matching / flagging — never mutates display names.
 */

export function normalisePersonName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(drg|dr|ir|hj|h|s\.k\.m|skm|s\.kom|s\.t|st|s\.e|se|s\.h|sh|m\.t|mt|m\.si|msi|m\.m|mm|m\.k\.k\.k|mkkk|mk3)\b\.?/gi,
      "",
    )
    .replace(/[.,'"`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) {
    const row = dp[i];
    if (row) row[0] = i;
  }
  for (let j = 0; j <= n; j++) {
    const firstRow = dp[0];
    if (firstRow) firstRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const curRow = dp[i];
      const prevRow = dp[i - 1];
      if (!curRow || !prevRow) continue;
      const del = (prevRow[j] ?? 0) + 1;
      const ins = (curRow[j - 1] ?? 0) + 1;
      const sub = (prevRow[j - 1] ?? 0) + cost;
      curRow[j] = Math.min(del, ins, sub);
    }
  }

  return dp[m]?.[n] ?? Math.max(m, n);
}

export function computeNameSimilarity(a: string, b: string): number {
  const na = normalisePersonName(a);
  const nb = normalisePersonName(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshteinDistance(na, nb);
  return Math.max(0, Number(((maxLen - dist) / maxLen).toFixed(4)));
}

export function isInitialAbbreviationMatch(
  ktpName: string,
  otherName: string,
): boolean {
  const ktpTokens = normalisePersonName(ktpName).split(" ").filter(Boolean);
  const otherTokens = normalisePersonName(otherName).split(" ").filter(Boolean);

  if (ktpTokens.length === 0 || otherTokens.length === 0) return false;
  if (otherTokens.length > ktpTokens.length) return false;

  return otherTokens.every((tok, idx) => {
    const ktpTok = ktpTokens[idx];
    if (!ktpTok) return false;
    if (tok === ktpTok) return true;
    // e.g. "P" matches "Pangabean"
    return tok.length === 1 && ktpTok.startsWith(tok);
  });
}
