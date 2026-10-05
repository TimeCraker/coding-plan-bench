// T-006 transport 集成测试（AC-003）：
// - samples=3/5 不改变 transport（browser-direct 的所有请求都打 provider，不打 /api）
// - trusted-proxy 无 consent 零请求；有 consent 恰一次 POST 代理
// - Tauri adapter 只打 provider，不调用项目 /api（DoD）
// - CORS 失败不自动代理；取消 abort 当前样本并停止后续
import { afterEach, describe, expect, it, vi } from "vitest";
import { runBench, createConsentToken } from "../../site/src/lib/transports";
import { CPB_STANDARD_PROFILE } from "../../engine/profiles";
import { ANTHROPIC_STREAM } from "../fixtures/sse";

// mock Tauri HTTP 插件（记录调用目标）。
// vi.mock 工厂必须自包含：外部变量经 vi.hoisted 提升，SSE 内容在工厂内动态 import。
const { tauriFetchCalls } = vi.hoisted(() => ({ tauriFetchCalls: [] as string[] }));
vi.mock("@tauri-apps/plugin-http", async () => {
  const { ANTHROPIC_STREAM } = await import("../fixtures/sse");
  return {
    fetch: async (input: RequestInfo | URL) => {
      tauriFetchCalls.push(String(input));
      const bytes = new TextEncoder().encode(ANTHROPIC_STREAM);
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(bytes);
          c.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    },
  };
});

import { loadTauriTransport } from "../../site/src/lib/transports";

function anthropicStreamResponse(): Response {
  const bytes = new TextEncoder().encode(ANTHROPIC_STREAM);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function makeFetchWith(responder: () => Response): typeof fetch {
  const impl: typeof fetch = async (_input, _init) => responder();
  return impl;
}

/** 记录全部请求 URL 的 fetch */
function recordingFetch(log: string[], responder: () => Response): typeof fetch {
  return async (input, _init) => {
    log.push(String(input));
    return responder();
  };
}

const BASE = {
  requestUrl: "https://api.anthropic.com/v1/messages",
  apiKey: "sk-t-test",
  model: "claude-test",
  protocol: "anthropic" as const,
  profile: CPB_STANDARD_PROFILE,
};

afterEach(() => {
  tauriFetchCalls.length = 0;
});

describe("samples 与 transport 正交（AC-003）", () => {
  for (const samples of [1, 3, 5] as const) {
    it(`browser-direct samples=${samples}：全部请求打 provider，无 /api`, async () => {
      const log: string[] = [];
      const run = await runBench({
        ...BASE,
        transport: "browser-direct",
        samples,
        fetchImpl: recordingFetch(log, anthropicStreamResponse),
      });
      expect(run.transport).toBe("browser-direct");
      expect(run.requestedSamples).toBe(samples);
      expect(run.status).toBe("complete");
      expect(log.length).toBe(samples);
      expect(log.every((u) => u === BASE.requestUrl)).toBe(true);
      // 项目代理路径是 {apiBase}/bench：不得出现（provider URL 自身可含 /api 段）
      expect(log.some((u) => u.endsWith("/bench"))).toBe(false);
    });
  }
});

describe("trusted-proxy consent 门禁（AC-003）", () => {
  it("无 consent：抛 consent 错误且 0 次网络请求", async () => {
    const log: string[] = [];
    await expect(
      runBench({
        ...BASE,
        transport: "trusted-proxy",
        samples: 1,
        fetchImpl: recordingFetch(log, anthropicStreamResponse),
      }),
    ).rejects.toMatchObject({ code: "consent" });
    expect(log).toHaveLength(0);
  });

  it("有 consent：恰一次 POST 代理并透传 BenchmarkRunResult", async () => {
    const log: string[] = [];
    const run = await runBench({
      ...BASE,
      transport: "trusted-proxy",
      samples: 3,
      consent: createConsentToken(),
      fetchImpl: recordingFetch(log, () =>
        Response.json(
          {
            schemaVersion: 2,
            measurementVersion: 1,
            profile: {
              id: "cpb-standard",
              version: 1,
              promptSha256: "x",
            },
            transport: "trusted-proxy",
            status: "complete",
            requestedSamples: 3,
            successCount: 3,
            aggregate: {
              ttftMs: 100,
              thinkingMs: null,
              generationMs: 900,
              totalMs: 1000,
              outputTokens: 90,
              inputTokens: 10,
              tps: 100,
              tokenSource: "provider",
            },
            samples: [],
          },
          { status: 200 },
        ),
      ),
    });
    // 代理端执行多样本：客户端只发一次
    expect(log).toHaveLength(1);
    expect(log[0]).toContain("/bench");
    expect(run.requestedSamples).toBe(3);
    expect(run.transport).toBe("trusted-proxy");
  });

  it("代理 403 ORIGIN_NOT_ALLOWED → proxy-policy 错误", async () => {
    await expect(
      runBench({
        ...BASE,
        transport: "trusted-proxy",
        samples: 1,
        consent: createConsentToken(),
        fetchImpl: async () =>
          Response.json(
            { error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin 不在允许列表" } },
            { status: 403 },
          ),
      }),
    ).rejects.toMatchObject({ code: "proxy-policy" });
  });
});

describe("tauri-local（DoD：不调用项目 /api）", () => {
  it("native fetch 只打 provider；经 plugin-http 加载", async () => {
    const t = await loadTauriTransport();
    const run = await t.run({ ...BASE, samples: 1 });
    expect(run.transport).toBe("tauri-local");
    expect(run.status).toBe("complete");
    expect(tauriFetchCalls).toHaveLength(1);
    expect(tauriFetchCalls[0]).toBe(BASE.requestUrl);
    // 项目代理路径是 {apiBase}/bench：不得出现
    expect(tauriFetchCalls.some((u) => u.endsWith("/bench"))).toBe(false);
  });
});

describe("CORS 失败不自动代理（AC-003）", () => {
  it("browser-direct 网络失败 → 样本 cors/network，绝不改打代理", async () => {
    const log: string[] = [];
    const run = await runBench({
      ...BASE,
      transport: "browser-direct",
      samples: 1,
      fetchImpl: async () => {
        log.push("direct-attempt");
        throw new TypeError("Failed to fetch");
      },
    });
    expect(run.status).toBe("failed");
    expect(run.samples[0]?.error?.code).toBe("cors/network");
    expect(log).toEqual(["direct-attempt"]); // 只有直连尝试，无代理回退
  });
});

describe("取消（AC-003 / FR-006）", () => {
  it("样本完成后取消：停止后续样本，status cancelled", async () => {
    const log: string[] = [];
    const controller = new AbortController();
    const run = await runBench({
      ...BASE,
      transport: "browser-direct",
      samples: 3,
      fetchImpl: recordingFetch(log, anthropicStreamResponse),
      signal: controller.signal,
      onProgress: ({ index }) => {
        if (index === 1) controller.abort();
      },
    });
    expect(run.status).toBe("cancelled");
    expect(log).toHaveLength(1);
  });
});

describe("progress 透传", () => {
  it("3 样本回调 3 次且 index 递增", async () => {
    const seen: number[] = [];
    await runBench({
      ...BASE,
      transport: "browser-direct",
      samples: 3,
      fetchImpl: makeFetchWith(() => anthropicStreamResponse()),
      onProgress: ({ index }) => seen.push(index),
    });
    expect(seen).toEqual([1, 2, 3]);
  });
});
