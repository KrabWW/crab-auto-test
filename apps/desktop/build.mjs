// esbuild bundles src/{main,preload,worker} → dist-electron/*.cjs
import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron", "playwright", "playwright-core"],
  logLevel: "info",
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["src/main/index.ts"],
    outfile: "dist-electron/main.cjs",
  }),
  build({
    ...shared,
    entryPoints: ["src/preload/index.ts"],
    outfile: "dist-electron/preload.cjs",
  }),
  build({
    ...shared,
    entryPoints: ["src/worker/index.ts"],
    outfile: "dist-electron/worker.cjs",
  }),
]);
console.log("desktop built");
