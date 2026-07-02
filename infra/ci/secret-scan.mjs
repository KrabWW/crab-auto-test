#!/usr/bin/env node
// secret-scan gate (SEC-XC-11 / SEC-PW-7): scan source, migrations, fixtures,
// and committed artifacts for hardcoded credentials/tokens/keys.
// Binary pass/fail.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["services", "apps", "packages", "infra"];
const SCAN_EXT = /\.(ts|js|mjs|cjs|vue|json|yml|yaml|env|sql|md)$/;

// High-signal patterns. Allow known-safe fixtures via baseline below.
const PATTERNS = [
  // AWS-style keys
  { re: /AKIA[0-9A-Z]{16}/, name: "AWS access key" },
  // Slack token
  { re: /xox[baprs]-[A-Za-z0-9-]{10,}/, name: "Slack token" },
  // GitHub PAT (classic + fine-grained)
  { re: /gh[pousr]_[A-Za-z0-9]{36,}/, name: "GitHub token" },
  // Google API key
  { re: /AIza[0-9A-Za-z_-]{35}/, name: "Google API key" },
  // Generic "sk-..." live-looking key (OpenAI etc.) — but allow example/redacted.
  { re: /\bsk-[A-Za-z0-9]{20,}\b/, name: "live API key (sk-...)" },
  // Private key block
  { re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/, name: "private key block" },
  // password = "..." assignments with a non-placeholder value
  { re: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/i, name: "hardcoded password" },
];

// Baseline allow-list: substrings that, if present, suppress the match.
const ALLOW = [
  "REDACTED",
  "change-me",
  "change me",
  "CHANGE_ME",
  "placeholder",
  "example",
  "admin12345", // seed dev credential (documented in .env.example)
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", // dev envelope key placeholder
  "dev-only-jwt-secret-change-me",
  "sk-super-secret-123", // unit test fixture (envelope.spec.ts)
  "sk-live-12345", // unit test fixture (redact.spec.ts) — redacted form checked, not secret
  "sk-x", // unit test fixture
];

function walk(dir, acc = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e);
    try {
      const st = statSync(p);
      if (st.isDirectory()) {
        if (e === "node_modules" || e === ".git" || e === "dist" || e === ".nuxt" || e === ".output" || e === "dist-electron") continue;
        walk(p, acc);
      } else if (SCAN_EXT.test(e)) {
        acc.push(p);
      }
    } catch {}
  }
  return acc;
}

const violations = [];
for (const root of ROOTS) {
  for (const f of walk(root)) {
    let src = "";
    try { src = readFileSync(f, "utf8"); } catch { continue; }
    for (const { re, name } of PATTERNS) {
      const m = src.match(re);
      if (m && !ALLOW.some((a) => m[0].includes(a) || src.includes(a))) {
        violations.push(`${f}: ${name} -> ${m[0].slice(0, 24)}...`);
      }
    }
  }
}

if (violations.length) {
  console.error("SECRET-SCAN FAIL — potential secrets detected:");
  for (const v of violations) console.error("  " + v);
  console.error("\nIf any are safe, add them to the ALLOW list in infra/ci/secret-scan.mjs.");
  process.exit(1);
}
console.log("SECRET-SCAN PASS — no hardcoded secrets detected.");
