import { describe, it, expect } from "vitest";
import { validateSafeExternalUrl } from "../ssrf";

describe("SSRF Protection (validateSafeExternalUrl)", () => {
  it("blocks insecure protocols, localhost, loopback, and private/metadata IPs", () => {
    const badUrls = [
      "http://api.openai.com/v1",
      "file:///etc/passwd",
      "https://localhost:3000/api",
      "https://127.0.0.1/admin",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/internal",
      "https://192.168.1.1/router",
      "https://172.16.0.10/db",
      "https://[::1]/local",
      "https://user:pass@api.openai.com/v1",
      "https://metadata.google.internal/",
    ];

    for (const u of badUrls) {
      const res = validateSafeExternalUrl(u);
      expect(res.safe).toBe(false);
    }
  });

  it("enforces domain allow-list for Google Drive URLs", () => {
    expect(
      validateSafeExternalUrl("https://drive.google.com/drive/folders/abc123", [
        "drive.google.com",
      ]).safe,
    ).toBe(true);

    expect(
      validateSafeExternalUrl("https://evil.example.com/drive/folders/abc123", [
        "drive.google.com",
      ]).safe,
    ).toBe(false);
  });

  it("allows valid HTTPS external AI gateway URLs", () => {
    expect(validateSafeExternalUrl("https://zro.moonmath.ai/v1").safe).toBe(true);
  });
});
