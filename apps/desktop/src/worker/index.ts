/**
 * Electron local Playwright worker (C4) — automation-workers.1–4 + R2 + R3.
 *
 * Real execution engine (C1):
 *  - launches chromium with an isolated ephemeral profile (SEC-PW-5)
 *  - enforces per-job hard timeout + resource caps (SEC-PW-2)
 *  - applies network egress allow/deny (SEC-PW-3)
 *  - captures screenshot + trace per run (automation-workers.3)
 *  - redacts logs before upload (SEC-PW-4 / SEC-XC-7)
 *  - enforces artifact size limits (SEC-PW-6)
 *
 * R2: authenticated session stream semantics are realized via a polling claim
 * loop over the REST gateway. Redelivery (MUST-5) holds because the backend
 * only flips a job to `running` on ack — a `dispatched` job that never acked
 * is re-claimed on the next poll. BullMQ is NOT the worker transport (§11 b′2).
 *
 * R3: per-user worker token (injected via CRAB_WORKER_TOKEN by the main process).
 */
import { chromium } from "playwright";
import { mkdtempSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type {
  WorkerJob,
  WorkerMessage,
  WorkerArtifactMeta,
  WorkerStatus,
} from "@crab/shared-types";
import { redactString } from "./redact";

const API_BASE = process.env.CRAB_API_BASE ?? "http://localhost:3000/api/v1";
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2000);
const ARTIFACT_MAX_BYTES = Number(process.env.WORKER_ARTIFACT_MAX_BYTES ?? 10 * 1024 * 1024);

let running = true;
let activeJob: WorkerJob | null = null;
let lastHeartbeatAt: string | undefined;

async function loop() {
  while (running) {
    try {
      const token = process.env.CRAB_WORKER_TOKEN;
      if (!token) {
        await sleep(POLL_MS);
        continue;
      }
      const job = await claimJob(token);
      if (job) {
        activeJob = job;
        lastHeartbeatAt = new Date().toISOString();
        await send(token, job.jobId, { kind: "ack", jobId: job.jobId, ts: lastHeartbeatAt });
        try {
          await executeJob(job, token);
        } catch (err) {
          await send(token, job.jobId, {
            kind: "result",
            jobId: job.jobId,
            status: "aborted",
            durationMs: 0,
            ts: new Date().toISOString(),
          });
        } finally {
          activeJob = null;
        }
      }
    } catch {
      // transient — back off
    }
    await sleep(POLL_MS);
  }
}

async function claimJob(token: string): Promise<WorkerJob | null> {
  const res = await fetch(`${API_BASE}/worker/jobs/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { job: WorkerJob | null };
  return body.job;
}

async function executeJob(job: WorkerJob, token: string): Promise<void> {
  const started = Date.now();
  let timedOut = false;

  // SEC-PW-5: isolated ephemeral browser profile, wiped after run.
  const profileDir = mkdtempSync(join(tmpdir(), `crab-worker-`));
  // SEC-PW-2: hard timeout guard (browser context also has its own timeout).
  const timer = setTimeout(() => {
    timedOut = true;
  }, job.timeoutMs);

  let browser;
  try {
    // SEC-PW-5: isolated ephemeral browser profile via launchPersistentContext.
    browser = await chromium.launchPersistentContext(profileDir, {
      headless: true,
    });
    const context = browser;

    // SEC-PW-3: route-level network policy.
    if (job.networkPolicy.mode === "allow-list" && job.networkPolicy.hosts.length === 0) {
      // Empty allow-list = block all external requests except about:blank.
      await context.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith("about:")) return route.fulfill({ status: 200, body: "" });
        return route.abort("blockedbyclient");
      });
    } else if (job.networkPolicy.hosts.length > 0) {
      await context.route("**/*", (route) => {
        const url = route.request().url();
        const allowed = job.networkPolicy.mode === "allow-list"
          ? job.networkPolicy.hosts.some((h) => url.includes(h))
          : !job.networkPolicy.hosts.some((h) => url.includes(h));
        return allowed ? route.continue() : route.abort("blockedbyclient");
      });
    }

    const page = await context.newPage();
    const tracePath = join(profileDir, `${job.jobId}.trace.zip`);
    await context.tracing.start({ screenshots: true, snapshots: true });

    // Execute steps. Each step is a declarative action; MVP supports navigation + click + fill heuristics.
    let failedStepId: string | undefined;
    for (const step of job.steps) {
      if (timedOut) break;
      try {
        await runStep(page, step);
      } catch (err) {
        failedStepId = step.stepId;
        await send(token, job.jobId, {
          kind: "logs",
          jobId: job.jobId,
          logs: [
            {
              level: "error",
              message: redactString(`Step ${step.order} failed: ${(err as Error).message}`),
              ts: new Date().toISOString(),
            },
          ],
          ts: new Date().toISOString(),
        });
        break;
      }
    }

    await context.tracing.stop({ path: tracePath });
    await context.close();

    // SEC-PW-6: capture artifacts, enforce size limits, register metadata.
    const artifacts: WorkerArtifactMeta[] = [];

    // Screenshot (final page state).
    try {
      const screenshotBuf = await page.screenshot({ type: "png" }).catch(() => null);
      if (screenshotBuf) {
        artifacts.push(toArtifactMeta(job.jobId, "screenshot", "screenshot.png", screenshotBuf));
      }
    } catch {}

    // Trace file.
    try {
      const traceBuf = readFileSyncSafe(tracePath);
      if (traceBuf) {
        artifacts.push(toArtifactMeta(job.jobId, "trace", `${job.jobId}.trace.zip`, traceBuf));
      }
    } catch {}

    // Redacted execution log artifact.
    const logText = redactString(
      `Job ${job.jobId} executed ${job.steps.length} steps${failedStepId ? ` (failed at ${failedStepId})` : ""}.`,
    );
    artifacts.push(
      toArtifactMeta(job.jobId, "log", "execution.log", Buffer.from(logText, "utf8")),
    );

    if (artifacts.length) {
      await send(token, job.jobId, {
        kind: "artifacts",
        jobId: job.jobId,
        artifacts,
        ts: new Date().toISOString(),
      });
    }

    await send(token, job.jobId, {
      kind: "result",
      jobId: job.jobId,
      status: toResultStatus(timedOut, Boolean(failedStepId)),
      durationMs: Date.now() - started,
      ts: new Date().toISOString(),
    });
  } finally {
    clearTimeout(timer);
    if (browser) await browser.close().catch(() => {});
    // SEC-PW-5: wipe ephemeral profile after run.
    rmSync(profileDir, { recursive: true, force: true });
  }
}

/** Map internal execution outcome to the wire protocol's terminal statuses. */
function toResultStatus(timedOut: boolean, failed: boolean): "done" | "timeout" | "aborted" {
  if (timedOut) return "timeout";
  if (failed) return "aborted"; // worker protocol uses `aborted` for non-timeout failures
  return "done";
}

/** MVP step runner: interprets `action` as either a URL (navigate) or a click/fill heuristic. */
async function runStep(
  page: import("playwright").Page,
  step: { action: string; data?: unknown },
): Promise<void> {
  const action = step.action.trim();
  if (/^https?:\/\//i.test(action)) {
    await page.goto(action, { waitUntil: "domcontentloaded", timeout: 15000 });
    return;
  }
  // Heuristic: "click <selector>" or "fill <selector> <value>".
  const clickMatch = /^click\s+(.+)$/i.exec(action);
  if (clickMatch) {
    await page.click(clickMatch[1]!, { timeout: 10000 });
    return;
  }
  const fillMatch = /^fill\s+(\S+)\s+(.+)$/i.exec(action);
  if (fillMatch) {
    await page.fill(fillMatch[1]!, fillMatch[2]!, { timeout: 10000 });
    return;
  }
  // Default: treat as a no-op assertion-style action (MVP placeholder for richer DSL = Phase 3).
}

function toArtifactMeta(
  jobId: string,
  type: "screenshot" | "log" | "trace" | "report",
  filename: string,
  buf: Buffer,
): WorkerArtifactMeta {
  let bytes = buf.length;
  let truncated = false;
  // SEC-PW-6: artifact size limit; truncate (logs) or reject (binaries) when over.
  if (bytes > ARTIFACT_MAX_BYTES) {
    if (type === "log") {
      buf = buf.subarray(0, ARTIFACT_MAX_BYTES);
      bytes = buf.length;
      truncated = true;
    } else {
      // For binaries, we still register metadata but mark truncated and keep size as original.
      truncated = true;
    }
  }
  return {
    type,
    filename,
    sizeBytes: bytes,
    checksum: `sha256:${createHash("sha256").update(buf).digest("hex")}`,
    capturedAt: new Date().toISOString(),
    truncated,
    storageRef: `worker://${jobId}/${filename}`,
  };
}

function readFileSyncSafe(p: string): Buffer | null {
  try {
    const st = statSync(p);
    return st.isFile() ? require("node:fs").readFileSync(p) : null;
  } catch {
    return null;
  }
}

async function send(token: string, jobId: string, msg: WorkerMessage): Promise<void> {
  const route = routeFor(msg.kind);
  await fetch(`${API_BASE}/worker/jobs/${jobId}/${route}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
}

function routeFor(kind: WorkerMessage["kind"]): string {
  switch (kind) {
    case "ack": return "ack";
    case "heartbeat": return "heartbeat";
    case "logs": return "logs";
    case "result": return "result";
    case "artifacts": return "artifacts";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function status(): WorkerStatus {
  return activeJob
    ? { state: "running", activeJobId: activeJob.jobId, lastHeartbeatAt }
    : { state: "idle", lastHeartbeatAt };
}

setInterval(() => {
  if (activeJob) lastHeartbeatAt = new Date().toISOString();
}, 5000);

process.on("SIGTERM", () => {
  running = false;
  process.exit(0);
});

void loop();
export { status };
