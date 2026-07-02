/**
 * Electron preload (C2) — desktop-app.2: narrow typed bridge via contextBridge.
 * contextIsolation:true; renderer NEVER touches Node/fs/child_process.
 * Allowlist only (F4). No raw socket to renderer.
 */
import { contextBridge, ipcRenderer } from "electron";
import type { BridgeApi, StreamEnvelope } from "@crab/shared-types";

const api: BridgeApi = {
  worker: {
    start: () => ipcRenderer.invoke("worker:start"),
    stop: () => ipcRenderer.invoke("worker:stop"),
    status: () => ipcRenderer.invoke("worker:status"),
  },
  backend: {
    getEndpoint: () => ipcRenderer.invoke("backend:getEndpoint"),
    setEndpoint: (profile) => ipcRenderer.invoke("backend:setEndpoint", profile),
  },
  execution: {
    subscribe: (executionId, onEnvelope) => {
      const channel = `execution:${executionId}`;
      const listener = (_e: unknown, env: StreamEnvelope) => onEnvelope(env);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },
};

contextBridge.exposeInMainWorld("crabBridge", api);
