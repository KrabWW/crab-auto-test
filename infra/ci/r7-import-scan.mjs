#!/usr/bin/env node
// R7 CI import scan (Phase 2 relaxed): MCP/Skill nodes ARE now allowed in
// ai-orchestration (P2-5), invoked through controlled adapters. R7's invariant
// shifts from "MVP graph has no MCP/Skill" to "only ai-orchestration may import
// MCP/Skill adapters — renderer (apps/web) and worker (apps/desktop/worker)
// still MUST NOT". Binary pass/fail.
//
// What R7 now forbids:
//  - apps/web/**        : any MCP or Skill import (renderer is a thin client, §11 a7)
//  - apps/desktop/worker**: MCP or Skill imports (worker runs Playwright only; §11 a7)
//  - apps/desktop/main,preload,renderer**: MCP or Skill imports (Electron shell; §11 a7)
// What R7 now ALLOWS:
//  - services/api/src/modules/ai-orchestration/** : MCP/Skill imports via controlled adapters
//  - services/api/src/modules/mcp/** , skills/**   : the adapters themselves
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_GLOBS = [
  "apps/web",
  "apps/desktop/src/main",
  "apps/desktop/src/preload",
  "apps/desktop/src/renderer",
  "apps/desktop/src/worker",
];
const FORBIDDEN = [
  "@modelcontextprotocol",
  "../skills",
  "../mcp",
  "skill-adapter",
  "SkillAdapter",
  "McpService",
];

function walk(dir, acc = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e);
    try {
      const st = statSync(p);
      if (st.isDirectory()) {
        if (e === "node_modules" || e === "dist" || e === ".nuxt" || e === ".output" || e === "dist-electron") continue;
        walk(p, acc);
      } else if (p.endsWith(".ts") || p.endsWith(".vue") || p.endsWith(".mjs")) {
        acc.push(p);
      }
    } catch {}
  }
  return acc;
}

const violations = [];
for (const root of FORBIDDEN_GLOBS) {
  for (const f of walk(root)) {
    const src = readFileSync(f, "utf8");
    for (const sym of FORBIDDEN) {
      if (src.includes(sym)) violations.push(`${f}: ${sym}`);
    }
  }
}

if (violations.length) {
  console.error("R7 FAIL — MCP/Skill imports forbidden in renderer/worker (§11 a7):");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("R7 PASS (Phase 2 relaxed) — renderer/worker have no MCP/Skill imports; ai-orchestration may use controlled adapters.");
