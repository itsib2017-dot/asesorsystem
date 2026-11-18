import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptSecret, decryptSecret, maskSecret } from "../encryption";

describe("AES-256-GCM Encryption Helper", () => {
  const prevSecret = process.env.BYOK_ENCRYPTION_SECRET;

  beforeEach(() => {
    process.env.BYOK_ENCRYPTION_SECRET = "test-secret-minimum-32-characters-long-key!";
  });

  afterEach(() => {
    if (prevSecret === undefined) {
      delete process.env.BYOK_ENCRYPTION_SECRET;
    } else {
      process.env.BYOK_ENCRYPTION_SECRET = prevSecret;
    }
  });

  it("encrypts and decrypts a secret value correctly", () => {
    const original = "sk-ant-api03-secret-key-123456";
    const encrypted = encryptSecret(original);

    expect(encrypted).not.toEqual(original);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toEqual(original);
  });

  it("fails to decrypt if payload has been tampered with", () => {
    const original = "secret-value";
    const encrypted = encryptSecret(original);
    const parts = encrypted.split(":");
    const tampered = `${parts[0]}:${parts[1]}:${Buffer.from("tampered").toString("base64")}`;

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws explicitly if BYOK_ENCRYPTION_SECRET is missing or too short", () => {
    process.env.BYOK_ENCRYPTION_SECRET = "short";
    expect(() => encryptSecret("abc")).toThrow(/BYOK_ENCRYPTION_SECRET/);
  });

  it("masks secrets safely without leaking middle chars", () => {
    expect(maskSecret("sk-ant-api03-12345678abcd")).toBe("sk-a••••••••abcd");
    expect(maskSecret("short")).toBe("••••••••");
  });
});
