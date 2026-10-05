import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 主拓扑为 Cloudflare Pages（根路径部署，S01 冻结）
  // VITE_BASE 仅作特殊子路径托管时的覆盖开关，GitHub Pages 不再是部署事实源
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
