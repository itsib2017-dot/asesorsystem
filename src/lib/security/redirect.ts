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
