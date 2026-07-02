/**
 * Electron typed bridge (F4 contract).
 *
 * desktop-app.2: native access ONLY via this narrow typed preload bridge with
 * context isolation enabled. Renderer NEVER touches Node/fs/child_process.
 *
 * Allowlist is exhaustive. Adding a method requires a spec-traceable
 * justification (§11 F7 catch-all).
 */
export type EndpointProfile = "local" | "staging" | "production";

export interface BridgeApi {
  worker: {
    start(): Promise<void>;
    stop(): Promise<void>;
    status(): Promise<import("./worker").WorkerStatus>;
  };
  backend: {
    getEndpoint(): Promise<EndpointProfile>;
    /** Accepts an enumerated profile only — no free string. */
    setEndpoint(profile: EndpointProfile): Promise<void>;
  };
  execution: {
    /** Proxies streaming envelopes — renderer holds no raw socket (§7). */
    subscribe(
      executionId: string,
      onEnvelope: (e: import("./stream").StreamEnvelope) => void,
    ): () => void;
  };
}

/** Typed sentinel exposed via contextBridge as `window.crabBridge`. */
export const BRIDGE_GLOBAL = "crabBridge" as const;
