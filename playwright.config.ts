import { defineConfig, devices } from "@playwright/test";

// e2e / a11y / responsive / visual 共用一份 Playwright 配置。
// - channel: msedge —— Windows 11 自带 Edge，避免下载 Chromium 二进制；
//   本机若无 Edge 可设 PW_CHANNEL=chromium（需要 `npx playwright install chromium`）。
// - webServer 自动起 Vite dev server（API 代理到本地 Worker 由测试内 mock 处理）。
const channel = process.env.PW_CHANNEL ?? "msedge";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: {
    // 视觉对比：快照名去平台后缀（win32/linux 共用基线），余量 0.05 吸收
    // 本地 Edge 与 CI chromium 的字形栅格化差异（2026-10-05 CI 实测踩坑）
    toHaveScreenshot: { maxDiffPixelRatio: 0.05, snapshotNameTemplate: "{arg}{ext}" },
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    // junit 原始报告（CI artifact；本地输出到 gitignored test-results/）
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    channel,
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
