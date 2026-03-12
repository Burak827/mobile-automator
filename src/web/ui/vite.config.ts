import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: currentDir,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    outDir: resolve(currentDir, "../public"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(currentDir, "index.html"),
        sstest: resolve(currentDir, "sstest.html"),
        closedBezierCurve: resolve(currentDir, "closed-bezier-curve.html"),
      },
    },
  },
});
