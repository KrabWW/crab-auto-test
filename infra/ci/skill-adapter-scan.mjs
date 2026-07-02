#!/usr/bin/env node
// SEC-SKILL-4 CI scan: Skills controlled adapters MUST NOT use arbitrary code
// execution — no eval / vm.runInNewContext / dynamic require of skill payloads.
// Binary pass/fail. (skills-store.4: controlled adapters only.)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "services/api/src/modules/skills";
const FORBIDDEN = [
  /\beval\s*\(/,
  /vm\.runInNewContext/,
  /vm\.runInThisContext/,
  /new\s+Function\s*\(/,
  // dynamic require of a variable (skill payload) — allow static require('x') only.
  /require\(\s*[^'"\s)]/,
];

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

const violations = [];
for (const f of walk(ROOT)) {
  const raw = readFileSync(f, "utf8");
  // Strip line/block comments so docs that name the forbidden APIs (e.g.
  // "no vm.runInNewContext") don't false-positive. Code-only scan.
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const pat of FORBIDDEN) {
    const m = src.match(pat);
    if (m) violations.push(`${f}: ${m[0]}`);
  }
}

if (violations.length) {
  console.error("SEC-SKILL-4 FAIL — arbitrary code execution in skills adapters:");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("SEC-SKILL-4 PASS — skills adapters use no eval/vm/dynamic-require.");
