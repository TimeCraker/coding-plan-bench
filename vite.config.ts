import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages 用子路径 base, Cloudflare Pages/本地用根路径
  // 通过环境变量 VITE_BASE 覆盖; Pages 部署时不设 = 默认 /
  base: process.env.VITE_BASE || "/",
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
