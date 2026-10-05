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
    // 视觉对比给字体 AA / 渲染差异留少量余量，避免跨机抖动
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
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
