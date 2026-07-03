#!/usr/bin/env node
// Clean-room scan: assert no WHartTest source/asset/prompt/logo/copy/style is
// imported or copied into the new implementation. Binary pass/fail.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["services", "apps", "packages"];
const SCAN_EXT = /\.(ts|js|mjs|vue|json)$/;
// Skip CI scripts themselves + .omc/openspec docs (provenance lives there).
const SKIP = (f) =>
  f.includes("infra/ci/") ||
  f.includes("node_modules") ||
  f.includes(`${join("apps", "web", ".nuxt")}`) ||
  f.includes(`${join("apps", "web", ".output")}`);
const FORBIDDEN = [
  /WHartTest/i,
  /from\s+['"][^'"]*WHartTest/i,
  /require\(['"][^'"]*WHartTest/i,
  /WHartTest_Django/,
  /WHartTest_Vue/,
  /WHartTest_Actuator/,
  /WHartTest_MCP/,
  /WHartTest_Skills/,
];

function walk(dir, acc = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e);
    try {
      if (statSync(p).isDirectory()) walk(p, acc);
      else if (SCAN_EXT.test(e) && !SKIP(p)) acc.push(p);
    } catch {}
  }
  return acc;
}

const violations = [];
for (const root of ROOTS) {
  for (const f of walk(root)) {
    const src = readFileSync(f, "utf8");
    for (const pat of FORBIDDEN) {
      if (pat.test(src)) violations.push(`${f}: ${pat}`);
    }
  }
}

if (violations.length) {
  console.error("CLEAN-ROOM FAIL — upstream references detected:");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("CLEAN-ROOM PASS — no WHartTest imports/copies in implementation.");
