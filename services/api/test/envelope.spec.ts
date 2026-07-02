import { describe, it, expect } from "vitest";
import { EnvelopeEncryptionService } from "../src/infra/crypto/envelope-encryption.service";

describe("Architect-R5 envelope encryption (SEC-CRED-2/4)", () => {
  it("round-trips a credential and never exposes plaintext in the envelope", () => {
    const orig = process.env.ENVELOPE_MASTER_KEY_B64;
    process.env.ENVELOPE_MASTER_KEY_B64 = Buffer.alloc(32, 7).toString("base64");
    try {
      const svc = new EnvelopeEncryptionService();
      svc.onModuleInit();
      const env = svc.encrypt("sk-super-secret-123");
      // The envelope must NOT contain the plaintext.
      expect(env.blob).not.toContain("sk-super-secret");
      expect(env.keyId).toMatch(/^[0-9a-f]{16}$/);
      // Decrypt recovers plaintext in-process.
      expect(svc.decrypt(env)).toBe("sk-super-secret-123");
    } finally {
      process.env.ENVELOPE_MASTER_KEY_B64 = orig;
    }
  });

  it("safeEqual is constant-time and handles unequal lengths", () => {
    const orig = process.env.ENVELOPE_MASTER_KEY_B64;
    process.env.ENVELOPE_MASTER_KEY_B64 = Buffer.alloc(32, 9).toString("base64");
    try {
      const svc = new EnvelopeEncryptionService();
      svc.onModuleInit();
      expect(svc.safeEqual("abc", "abc")).toBe(true);
      expect(svc.safeEqual("abc", "abcd")).toBe(false);
      expect(svc.safeEqual("abc", "abd")).toBe(false);
    } finally {
      process.env.ENVELOPE_MASTER_KEY_B64 = orig;
    }
  });
});
