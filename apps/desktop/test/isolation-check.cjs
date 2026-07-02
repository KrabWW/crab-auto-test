/**
 * D2 / SEC-EL-6: Electron renderer isolation self-check.
 *
 * This script runs in the Electron MAIN process and verifies the renderer
 * security posture without needing an interactive display: it loads a tiny
 * data: page in a BrowserWindow with the same webPreferences as production,
 * then injects a probe that asserts the renderer has NO `require`/`process`/
 * `fs`/`child_process` and that the `crabBridge` surface is exactly the
 * allowlisted methods. Exits non-zero on violation.
 *
 * Run: pnpm --filter @crab/desktop exec electron test/isolation-check.cjs
 * (after `pnpm --filter @crab/desktop build`)
 */
const { app, BrowserWindow } = require("electron");
const path = require("node:path");

const PRELOAD = path.join(__dirname, "..", "dist-electron", "preload.cjs");

const ALLOWED_BRIDGE_KEYS = ["worker", "backend", "execution"];

async function run() {
  await app.whenReady();
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: PRELOAD,
    },
  });

  const probe = `
    (async () => {
      const forbidden = ['require','process','fs','child_process'];
      const present = forbidden.filter(k => typeof window[k] !== 'undefined');
      const bridgeKeys = window.crabBridge ? Object.keys(window.crabBridge).sort() : [];
      const workerKeys = window.crabBridge && window.crabBridge.worker ? Object.keys(window.crabBridge.worker) : [];
      const backendKeys = window.crabBridge && window.crabBridge.backend ? Object.keys(window.crabBridge.backend) : [];
      const execKeys = window.crabBridge && window.crabBridge.execution ? Object.keys(window.crabBridge.execution) : [];
      const result = { present, bridgeKeys, workerKeys, backendKeys, execKeys };
      document.title = JSON.stringify(result);
    })();
  `;
  await win.loadURL("data:text/html,<html><body></body></html>");
  await win.webContents.executeJavaScript(probe, true);

  // Give the async probe a tick to set the title.
  await new Promise((r) => setTimeout(r, 200));
  const title = win.getTitle();
  let result;
  try {
    result = JSON.parse(title);
  } catch {
    console.error("ISOLATION FAIL: probe did not return JSON (got:", title, ")");
    app.exit(1);
    return;
  }

  const failures = [];
  if (result.present.length > 0) {
    failures.push(`renderer exposed Node globals: ${result.present.join(", ")}`);
  }
  const bridgeKeys = result.bridgeKeys;
  const expected = [...ALLOWED_BRIDGE_KEYS].sort();
  if (JSON.stringify(bridgeKeys) !== JSON.stringify(expected)) {
    failures.push(`bridge keys mismatch: got ${JSON.stringify(bridgeKeys)} expected ${JSON.stringify(expected)}`);
  }
  const subKeyMap = { worker: "workerKeys", backend: "backendKeys", execution: "execKeys" };
  for (const [sub, key] of Object.entries(subKeyMap)) {
    const got = result[key];
    if (!Array.isArray(got) || got.length === 0) {
      failures.push(`bridge.${sub} missing methods (got ${JSON.stringify(got)})`);
    }
  }

  if (failures.length) {
    console.error("ISOLATION FAIL:");
    for (const f of failures) console.error("  - " + f);
    app.exit(1);
  } else {
    console.log("ISOLATION PASS — renderer has no Node globals; bridge allowlist is exact:", bridgeKeys.join(","));
    app.exit(0);
  }
}

run().catch((e) => {
  console.error(e);
  app.exit(1);
});
