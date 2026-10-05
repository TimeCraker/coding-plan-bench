import { defineConfig } from "vitest/config";
import path from "node:path";

// 单测/集成测试配置：node 环境（engine/server 均为纯逻辑 + 注入式 fetch）。
// 禁止真实网络：tests/setup/no-network.ts 把未 mock 的 global fetch 变成硬错误。
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "site/src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/config/**/*.test.ts",
    ],
    setupFiles: ["tests/setup/no-network.ts"],
    // deterministic：测试内不允许真实计时抖动影响断言（engine 通过注入 now() 控制）
    testTimeout: 10_000,
  },
});
