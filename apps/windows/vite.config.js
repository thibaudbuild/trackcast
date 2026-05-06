import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST || "127.0.0.1";
const appRoot = fileURLToPath(new URL("../../packages/app", import.meta.url));
const appDist = fileURLToPath(new URL("dist", import.meta.url));
const brandRoot = fileURLToPath(new URL("../../assets/brand", import.meta.url));
const localNodeModules = fileURLToPath(new URL("node_modules", import.meta.url));
const rootNodeModules = fileURLToPath(new URL("../../node_modules", import.meta.url));
const dependencyRoot = existsSync(localNodeModules) ? localNodeModules : rootNodeModules;

export default defineConfig({
  root: appRoot,
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: [
      { find: /^react$/, replacement: `${dependencyRoot}/react` },
      { find: /^react-dom$/, replacement: `${dependencyRoot}/react-dom` },
      { find: /^react-dom\/(.*)$/, replacement: `${dependencyRoot}/react-dom/$1` },
      { find: /^@tauri-apps\/api$/, replacement: `${dependencyRoot}/@tauri-apps/api` },
      { find: /^@tauri-apps\/api\/(.*)$/, replacement: `${dependencyRoot}/@tauri-apps/api/$1` },
      { find: /^@tauri-apps\/plugin-dialog$/, replacement: `${dependencyRoot}/@tauri-apps/plugin-dialog` },
      { find: /^@tauri-apps\/plugin-fs$/, replacement: `${dependencyRoot}/@tauri-apps/plugin-fs` },
      { find: /^@tauri-apps\/plugin-shell$/, replacement: `${dependencyRoot}/@tauri-apps/plugin-shell` },
      { find: /^@brand\/(.*)$/, replacement: `${brandRoot}/$1` },
    ],
  },
  build: {
    outDir: appDist,
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
    host,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    fs: {
      allow: [appRoot, brandRoot],
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
