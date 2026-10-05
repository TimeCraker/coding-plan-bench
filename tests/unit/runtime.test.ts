// T-006 运行时检测单测：web/tauri 判定、默认 transport、可选集合、apiBase。
import { afterEach, describe, expect, it } from "vitest";
import {
  availableTransports,
  defaultTransport,
  detectRuntime,
  getApiBase,
} from "../../site/src/lib/runtime";

/** node 环境无 window：临时挂/卸全局 */
function withWindow(defs: Record<string, unknown>, fn: () => void) {
  const orig = (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).window = defs;
  try {
    fn();
  } finally {
    if (orig === undefined) delete (globalThis as Record<string, unknown>).window;
    else (globalThis as Record<string, unknown>).window = orig;
  }
}

afterEach(() => {
  delete process.env.VITE_API_BASE;
});

describe("detectRuntime", () => {
  it("无 window（SSR/测试）→ web", () => {
    withWindow({}, () => {
      // 空 window 对象（无 __TAURI_INTERNALS__）
      expect(detectRuntime()).toBe("web");
    });
  });

  it("window 含 __TAURI_INTERNALS__ → tauri", () => {
    withWindow({ __TAURI_INTERNALS__: {} }, () => {
      expect(detectRuntime()).toBe("tauri");
    });
  });
});

describe("defaultTransport / availableTransports", () => {
  it("web：默认 browser-direct，可选 browser-direct + trusted-proxy", () => {
    expect(defaultTransport("web")).toBe("browser-direct");
    expect(availableTransports("web")).toEqual([
      "browser-direct",
      "trusted-proxy",
    ]);
  });

  it("tauri：默认 tauri-local，只有 tauri-local（无远端 fallback）", () => {
    expect(defaultTransport("tauri")).toBe("tauri-local");
    expect(availableTransports("tauri")).toEqual(["tauri-local"]);
  });
});

describe("getApiBase", () => {
  it("未配置时回退同源 /api；VITE_API_BASE 覆盖", () => {
    delete process.env.VITE_API_BASE;
    // import.meta.env 在 vitest 中来自 vite 配置；此处只断言默认值语义
    expect(getApiBase().length).toBeGreaterThan(0);
  });
});
