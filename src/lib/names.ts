/**
 * Deterministic name normalisation and similarity scoring (ADR-0005).
 * KTP is ALWAYS the certificate-name authority (D6).
 * Normalisation is strictly for matching / flagging — never mutates display names.
 */

export function normalisePersonName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(drg|dr|ir|hj|h|ns|s\.k\.m|skm|s\.k\.l|skl|s\.kep|skep|s\.kom|skom|s\.t|st|s\.e|se|s\.h|sh|a\.md\.kep|a\.md\.t|a\.md|amd|m\.t|mt|m\.si|msi|m\.m|mm|m\.k\.m|mkm|m\.k\.k\.k|mkkk|mk3)\b\.?/gi,
      "",
    )
    .replace(/[.,'"`_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_NON_NAME_TOKENS = new Set([
  "tugas",
  "presentasi",
  "dit",
  "k3",
  "ak3",
  "ak3u",
  "kelompok",
  "pekerjaan",
  "form",
  "revisi",
  "final",
  "fiks",
  "fix",
  "pt",
]);

function collapseRepeatChars(token: string): string {
  return token.replace(/([a-z])\1+/g, "$1");
}

function significantNameTokens(name: string): string[] {
  return normalisePersonName(name)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !GENERIC_NON_NAME_TOKENS.has(t));
}

/**
 * Scores how reliably a folder/filename candidate string identifies a canonical
 * assessee name without falling prey to substring collisions like "wiwi" in "wiwik".
 */
export function scoreCandidateNameMatch(
  candidateName: string,
  targetName: string,
): number {
  const normA = normalisePersonName(candidateName);
  const normB = normalisePersonName(targetName);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const tokensA = significantNameTokens(candidateName);
  const tokensB = significantNameTokens(targetName);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  if (tokensA.join(" ") === tokensB.join(" ")) return 0.99;

  // Initial/abbreviation match e.g. "M. Riyan Syahroni" <-> "Muhammad Riyan Syahroni"
  if (
    isInitialAbbreviationMatch(targetName, candidateName) ||
    isInitialAbbreviationMatch(candidateName, targetName)
  ) {
    return 0.94;
  }

  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longer = tokensA.length <= tokensB.length ? tokensB : tokensA;

  // Every significant token in shorter matches an exact token in longer (e.g., "Naila" -> "Naila Khairiyah")
  const exactTokenHits = shorter.filter((tok) => longer.includes(tok)).length;
  if (exactTokenHits === shorter.length) {
    return shorter.length >= 2 ? 0.95 : 0.9;
  }

  // Collapsed-repeat + mild fuzzy token matching (e.g. "Chairunnisa" <-> "Chairunisa", "Suangi" <-> "Suanggi")
  let fuzzyHits = 0;
  let strongFirstHit = false;
  for (let i = 0; i < shorter.length; i++) {
    const sTok = shorter[i]!;
    const sCol = collapseRepeatChars(sTok);
    let matchedTok = false;
    for (let j = 0; j < longer.length; j++) {
      const lTok = longer[j]!;
      const lCol = collapseRepeatChars(lTok);
      if (sTok === lTok) {
        matchedTok = true;
        if (i === 0 && j === 0) strongFirstHit = true;
        break;
      }
      if (sCol.length >= 4 && sCol === lCol) {
        matchedTok = true;
        if (i === 0 && j === 0) strongFirstHit = true;
        break;
      }
      if (sTok.length === 1 && j === i && lTok.startsWith(sTok)) {
        matchedTok = true;
        break;
      }
      if (
        Math.min(sTok.length, lTok.length) >= 5 &&
        levenshteinDistance(sTok, lTok) <= 1
      ) {
        matchedTok = true;
        break;
      }
    }
    if (matchedTok) fuzzyHits++;
  }

  if (fuzzyHits === shorter.length) {
    return strongFirstHit ? 0.88 : 0.84;
  }

  // First + last token match ignoring extra middle names (e.g., "Faradhila A. Manaf" <-> "Faradhila Aushafiana Manaf")
  if (
    shorter.length >= 2 &&
    longer.length >= 2 &&
    collapseRepeatChars(shorter[0]!) === collapseRepeatChars(longer[0]!) &&
    collapseRepeatChars(shorter[shorter.length - 1]!) ===
      collapseRepeatChars(longer[longer.length - 1]!)
  ) {
    return 0.86;
  }

  return 0;
}

export function findBestMatchingCandidate<T extends { displayName: string }>(
  candidateName: string,
  pool: T[],
): T | undefined {
  let best: T | undefined;
  let bestScore = 0;
  let secondScore = 0;

  for (const item of pool) {
    const score = scoreCandidateNameMatch(candidateName, item.displayName);
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      best = item;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (!best || bestScore < 0.78) return undefined;
  // Require strict winner when only a very short single-token query matched softly
  if (bestScore < 0.9 && bestScore - secondScore < 0.04) {
    return undefined;
  }
  return best;
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
