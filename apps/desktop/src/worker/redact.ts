/** SEC-XC-7 / SEC-PW-4: redaction util for worker logs before upload. */
const PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: /Bearer\s+[A-Za-z0-9._\-]+/gi, replacement: "Bearer [REDACTED]" },
  { re: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: "[JWT]" },
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replacement: "[EMAIL]" },
];

export function redactString(s: string): string {
  let out = s;
  for (const { re, replacement } of PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}
