// vitest 全局 setup：单元/集成测试禁止真实网络访问。
// 所有需要 fetch 的代码路径必须通过注入的 mock fetchImpl / app.request()。
// 这保证 "测试不得访问真实 provider" 是机械事实而不是约定。

import { afterAll, beforeAll } from "vitest";

const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = (() => {
    throw new Error(
      "REAL_NETWORK_FORBIDDEN: unit/integration tests must inject a mock fetchImpl",
    );
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
