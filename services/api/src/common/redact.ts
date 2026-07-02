/**
 * SEC-XC-7: shared redaction utility.
 * Scrubs credentials/tokens/PII from logs/args/metadata before persistence.
 */
const PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  // bearer / api keys
  { re: /Bearer\s+[A-Za-z0-9._\-]+/gi, replacement: "Bearer [REDACTED]" },
  { re: /(?:api[_-]?key|apikey|secret|token|password|authorization)["'\s:=]+[^\s,"'}]+/gi, replacement: "$1[REDACTED]" },
  // emails
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replacement: "[EMAIL]" },
  // common JWT shape
  { re: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: "[JWT]" },
];

export function redact(input: unknown): unknown {
  if (input == null) return input;
  if (typeof input === "string") return redactString(input);
  if (Array.isArray(input)) return input.map(redact);
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (
        key.includes("secret") ||
        key.includes("password") ||
        key.includes("token") ||
        key.includes("credential") ||
        key.includes("apikey") ||
        key.includes("api_key")
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return input;
}

export function redactString(s: string): string {
  let out = s;
  for (const { re, replacement } of PATTERNS) {
    out = out.replace(re, replacement as string);
  }
  return out;
}
