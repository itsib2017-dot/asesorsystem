/**
 * Removes NUL bytes, disallowed C0/DEL control characters, Unicode non-characters
 * (U+FFFE/U+FFFF), and unpaired UTF-16 surrogates in a single O(n) pass so
 * extracted document text is always valid UTF-8 for PostgreSQL persistence.
 * Preserves `\t`, `\n`, `\r`, and valid surrogate pairs (e.g. emoji).
 */
export function sanitizeExtractedText(raw: string): string {
  if (!raw) return "";

  let out = "";
  let chunkStart = 0;

  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);

    // Valid high surrogate followed by valid low surrogate -> keep pair intact.
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < raw.length ? raw.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 1;
        continue;
      }
      if (i > chunkStart) out += raw.slice(chunkStart, i);
      chunkStart = i + 1;
      continue;
    }

    // Unpaired low surrogate.
    if (code >= 0xdc00 && code <= 0xdfff) {
      if (i > chunkStart) out += raw.slice(chunkStart, i);
      chunkStart = i + 1;
      continue;
    }

    // Strip C0 control chars except tab (0x09), LF (0x0A), CR (0x0D), plus DEL (0x7F) & non-chars.
    const isAllowedWhitespace = code === 0x09 || code === 0x0a || code === 0x0d;
    const isDisallowedControl = (code <= 0x1f && !isAllowedWhitespace) || code === 0x7f;
    const isNonChar = code === 0xfffe || code === 0xffff;

    if (isDisallowedControl || isNonChar) {
      if (i > chunkStart) out += raw.slice(chunkStart, i);
      chunkStart = i + 1;
    }
  }

  if (chunkStart === 0) return raw;
  if (chunkStart < raw.length) out += raw.slice(chunkStart);
  return out;
}
