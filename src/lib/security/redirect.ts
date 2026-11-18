/**
 * Ensures post-login / auth-callback redirects strictly target safe internal app paths.
 * Rejects protocol-relative URLs ("//evil.com"), external origins, and backslashes.
 */
export function sanitizeInternalRedirect(
  target: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!target) return fallback;
  const trimmed = target.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.includes("\\")) {
    return fallback;
  }
  return trimmed;
}

/**
 * Resolves a validated request origin from forwarded headers without allowing
 * host-header injection.
 */
export function resolveSafeOrigin(hdrs: Headers): string {
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
  const protoHeader = hdrs.get("x-forwarded-proto") || "https";
  const proto = protoHeader === "http" ? "http" : "https";

  if (/^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(host)) {
    return `${proto}://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
