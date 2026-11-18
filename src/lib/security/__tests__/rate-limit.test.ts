import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  clearRateLimitBucketsForTest,
} from "../rate-limit";
import { sanitizeInternalRedirect } from "../redirect";

describe("rate-limit & redirect helpers", () => {
  beforeEach(() => {
    clearRateLimitBucketsForTest();
  });

  it("blocks requests exceeding maxRequests in window", () => {
    expect(checkRateLimit("register:1.2.3.4", 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit("register:1.2.3.4", 2, 60_000).allowed).toBe(true);
    const blocked = checkRateLimit("register:1.2.3.4", 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("sanitizes unsafe external or protocol-relative redirects", () => {
    expect(sanitizeInternalRedirect("/settings/provider")).toBe(
      "/settings/provider",
    );
    expect(sanitizeInternalRedirect("https://evil.com")).toBe("/dashboard");
    expect(sanitizeInternalRedirect("//evil.com/phish")).toBe("/dashboard");
    expect(sanitizeInternalRedirect("/\\evil.com", "/onboarding")).toBe(
      "/onboarding",
    );
  });
});
