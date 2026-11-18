const PRIVATE_IPV4_REGEX =
  /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "[::1]",
  "::1",
  "metadata.google.internal",
]);

/**
 * Validates an outbound URL against SSRF vectors.
 * Enforces HTTPS and rejects private/loopback/link-local network addresses.
 */
export function validateSafeExternalUrl(
  rawUrl: string,
  allowedDomains?: string[],
): { safe: true; url: URL } | { safe: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Format URL tidak valid." };
  }

  if (parsed.protocol !== "https:") {
    return { safe: false, reason: "Hanya protokol HTTPS yang diizinkan." };
  }

  const host = parsed.hostname.toLowerCase();

  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    PRIVATE_IPV4_REGEX.test(host) ||
    host.startsWith("[fe80:") ||
    host.startsWith("[fc") ||
    host.startsWith("[fd")
  ) {
    return {
      safe: false,
      reason: "Akses ke alamat jaringan internal atau loopback dilarang.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      safe: false,
      reason: "URL tidak boleh menyertakan kredensial tertanam.",
    };
  }

  if (allowedDomains && allowedDomains.length > 0) {
    const matched = allowedDomains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
    if (!matched) {
      return {
        safe: false,
        reason: `Domain '${host}' tidak termasuk dalam daftar domain yang diizinkan.`,
      };
    }
  }

  return { safe: true, url: parsed };
}
