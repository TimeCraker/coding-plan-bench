import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 部署在 github.io/coding-plan-bench/ 子路径, base 要对应
  base: "/coding-plan-bench/",
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
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
