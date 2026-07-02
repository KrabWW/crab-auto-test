/**
 * Electron renderer host (C3) — desktop-app.1 + R6.
 * Loads the apps/web SPA/static build. The renderer reaches the backend
 * through the SAME REST/stream/auth contracts as web (no privileged bypass).
 * No Node/fs/child_process (enforced by webPreferences in main).
 */
export {};
// The renderer is the Nuxt SPA loaded via loadFile/loadURL in main.
// This file documents the renderer host contract; the actual DOM is apps/web.
declare global {
  interface Window {
    crabBridge: import("@crab/shared-types").BridgeApi;
  }
}
