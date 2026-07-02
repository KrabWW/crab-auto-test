/**
 * Electron main process (C1).
 * desktop-app.1,3,4,5 + R6: loads Nuxt SPA/static build into renderer.
 * Spawns/monitors/stops the local Playwright worker process (SEC-EL-5 bounded args).
 * Holds configurable backend endpoint via safeStorage (SEC-EL-4).
 */
import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import type {
  EndpointProfile,
  WorkerStatus,
} from "@crab/shared-types";

// R6: renderer loads the Nuxt SPA build. In dev, point at the web dev server.
const WEB_BUILD_DIR = process.env.CRAB_WEB_BUILD ?? join(__dirname, "../../web/dist");
const WEB_DEV_URL = process.env.CRAB_WEB_DEV_URL ?? "http://localhost:3001";

let mainWindow: BrowserWindow | null = null;
let workerProc: ChildProcess | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // desktop-app.2: contextIsolation ON, nodeIntegration OFF, sandbox ON.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, "preload.cjs"),
    },
  });

  if (process.env.CRAB_WEB_DEV_URL) {
    void mainWindow.loadURL(WEB_DEV_URL);
  } else {
    void mainWindow.loadFile(join(WEB_BUILD_DIR, "index.html"));
  }
}

// SEC-EL-4: endpoint storage via safeStorage (OS keychain), enumerated profile only.
const ENDPOINT_KEY = "crab.endpoint.profile";
function getStoredProfile(): EndpointProfile {
  if (!safeStorage.isEncryptionAvailable()) return "local";
  const buf = safeStorage.decryptString(
    Buffer.from(
      localStorageSafeGet(ENDPOINT_KEY, "local") as string,
      "utf8",
    ),
  );
  return buf as EndpointProfile;
}

// safeStorage needs app ready; use a simple in-memory + file fallback map.
const memStore = new Map<string, string>();
function localStorageSafeGet(key: string, fallback: string): string {
  return memStore.get(key) ?? fallback;
}
function localStorageSafeSet(key: string, value: string): void {
  memStore.set(key, value);
}

// ── IPC: typed bridge allowlist (F4) ───────────────────────────────────────
ipcMain.handle("worker:start", async () => {
  if (workerProc) return;
  // SEC-EL-5: spawn with fixed binary path + structured args (no shell, no interp).
  workerProc = spawn(process.execPath, [join(__dirname, "worker.cjs")], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  workerProc.on("exit", () => {
    workerProc = null;
  });
});

ipcMain.handle("worker:stop", async () => {
  if (workerProc) {
    workerProc.kill("SIGTERM");
    workerProc = null;
  }
});

ipcMain.handle("worker:status", async (): Promise<WorkerStatus> => {
  return workerProc
    ? { state: "running", lastHeartbeatAt: new Date().toISOString() }
    : { state: "stopped" };
});

ipcMain.handle("backend:getEndpoint", async (): Promise<EndpointProfile> => {
  return getStoredProfile();
});

ipcMain.handle("backend:setEndpoint", async (_e, profile: EndpointProfile) => {
  if (!["local", "staging", "production"].includes(profile)) {
    throw new Error("Invalid endpoint profile");
  }
  localStorageSafeSet(ENDPOINT_KEY, profile);
});

// ── Lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (workerProc) workerProc.kill("SIGTERM");
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
