import { describe, it, expect } from "vitest";
import { redact, redactString } from "../src/common/redact";

describe("SEC-XC-7 / SEC-PW-4 redaction util", () => {
  it("scrubs bearer tokens, JWTs, and emails from strings", () => {
    const out = redactString(
      "Authorization: Bearer abc.def.ghi token=sk-live-12345 user@example.com",
    );
    expect(out).not.toContain("abc.def.ghi");
    expect(out).not.toContain("sk-live-12345");
    expect(out).not.toContain("user@example.com");
    expect(out).toContain("[REDACTED]");
    expect(out).toContain("[EMAIL]");
  });

  it("redacts object keys named secret/token/password/credential", () => {
    const out = redact({
      apiKey: "sk-x",
      nested: { token: "t", safe: "keep" },
      arr: [{ password: "p" }],
    }) as Record<string, unknown>;
    expect(out.apiKey).toBe("[REDACTED]");
    const nested = out.nested as Record<string, unknown>;
    expect(nested.token).toBe("[REDACTED]");
    expect(nested.safe).toBe("keep");
  });
});
