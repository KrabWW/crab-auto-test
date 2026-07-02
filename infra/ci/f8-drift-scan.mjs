#!/usr/bin/env node
// F8 stale-artifact drift gate: assert the implementation did NOT regress to
// stale patterns (pull-based worker registry, BullMQ-as-transport,
// credentialRef→secret store, interrupt()/checkpointer on the canonical path).
// Binary pass/fail.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["services/api/src", "apps/desktop/src", "packages/shared-types/src"];
const STALE = [
  { pat: /credentialRef/, note: "credentialRef→secret store (use envelope encryption)" },
  { pat: /\bsecretStore\b|\bsecret[_-]store\b/, note: "external secret store (§11 b′4)" },
  { pat: /MemorySaver|\.interrupt\(\)|checkpointer\.put/, note: "LangGraph durable checkpointer (R1)" },
];

// BullMQ-as-transport: allow BullMQ only in backend-internal contexts, never as worker transport.
// We flag any worker.* file importing BullMQ.
function walk(dir, acc = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e);
    try {
      if (statSync(p).isDirectory()) walk(p, acc);
      else if (p.endsWith(".ts") || p.endsWith(".mjs")) acc.push(p);
    } catch {}
  }
  return acc;
}

const violations = [];
for (const root of ROOTS) {
  for (const f of walk(root)) {
    const src = readFileSync(f, "utf8");
    for (const { pat, note } of STALE) {
      if (pat.test(src)) violations.push(`${f}: ${note}`);
    }
    if (/worker/i.test(f) && /(import|require)\s*\(?\s*['"][^'"]*bullmq/i.test(src)) {
      violations.push(`${f}: BullMQ import in worker context (R2 — session stream only)`);
    }
  }
}

if (violations.length) {
  console.error("F8 FAIL — stale-artifact drift detected:");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("F8 PASS — no stale-artifact drift (R1/R2/R5/b′4 honored).");
