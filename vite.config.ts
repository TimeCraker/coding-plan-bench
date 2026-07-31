import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // bench/ 不参与前端构建；前端在 site/ 之外时用 root 指向 site
  root: "site",
  publicDir: "public",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "site/src"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
