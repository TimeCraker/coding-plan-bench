// T-004 集成测试：runSample/runBenchmark 全链路（mock fetch + 可控时钟 + SSE fixtures）。
// 覆盖 AC-001/002 的接线面：空流 failed、取消、超时、非 2xx、重定向、progress、聚合。
import { describe, expect, it } from "vitest";
import { runBenchmark, runSample } from "../../engine/bench";
import { CPB_STANDARD_PROFILE } from "../../engine/profiles";
import { sampleInvariants } from "../../engine/types";
import {
  ANTHROPIC_EMPTY_STREAM,
  ANTHROPIC_STREAM,
  CRLF_STREAM,
  OPENAI_STREAM,
} from "../fixtures/sse";

const REQ = {
  url: "https://approved.example/v1/messages",
  headers: { "Content-Type": "application/json" },
  body: "{}",
};

function sseResponse(text: string, init?: ResponseInit): Response {
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
    ...init,
  });
}

/** 可控时钟：每次调用 +10ms */
function stepClock() {
  let t = 0;
  return () => (t += 10);
}

const PROFILE_META = {
  id: CPB_STANDARD_PROFILE.id,
  version: CPB_STANDARD_PROFILE.version,
  promptSha256: CPB_STANDARD_PROFILE.promptSha256,
};

describe("runSample", () => {
  it("anthropic 完整流：精确时间线（now 每次 +10）", async () => {
    // now 调用序：requestStart@10, usage@20, reasoning@30, reasoning@40,
    // text@50, text@60, usage@70, finish@80, streamEnd@90
    const s = await runSample(REQ, {
      protocol: "anthropic",
      fetchImpl: async () => sseResponse(ANTHROPIC_STREAM),
      now: stepClock(),
    });
    expect(s.status).toBe("complete");
    expect(s.ttftMs).toBe(40);
    expect(s.thinkingMs).toBe(20);
    expect(s.generationMs).toBe(10);
    expect(s.totalMs).toBe(80);
    expect(s.outputTokens).toBe(96);
    expect(s.tps).toBe(9600);
    expect(s.tokenSource).toBe("provider");
    expect(sampleInvariants(s)).toEqual([]);
  });

  it("CRLF 流照常解析且 usage 缺失 → tps null", async () => {
    const s = await runSample(REQ, {
      protocol: "anthropic",
      fetchImpl: async () => sseResponse(CRLF_STREAM),
      now: stepClock(),
    });
    expect(s.status).toBe("complete");
    expect(s.outputTokens).toBeNull();
    expect(s.tps).toBeNull();
    expect(s.tokenSource).toBe("unavailable");
  });

  it("openai 完整流（reasoning→content→usage）", async () => {
    const s = await runSample(REQ, {
      protocol: "openai",
      fetchImpl: async () => sseResponse(OPENAI_STREAM),
      now: stepClock(),
    });
    expect(s.status).toBe("complete");
    expect(s.outputTokens).toBe(42);
    expect(s.ttftMs).toBe(20);
  });

  it("空 2xx 流：failed / empty-output（不再 success+负 TTFT）", async () => {
    const s = await runSample(REQ, {
      protocol: "anthropic",
      fetchImpl: async () => sseResponse(ANTHROPIC_EMPTY_STREAM),
      now: stepClock(),
    });
    expect(s.status).toBe("failed");
    expect(s.error?.code).toBe("empty-output");
    expect(s.ttftMs).toBeNull();
    expect(s.totalMs).toBeGreaterThan(0);
  });

  it("401：failed / auth，不读不回显上游 body", async () => {
    const s = await runSample(REQ, {
      protocol: "anthropic",
      fetchImpl: async () =>
        new Response('{"error":{"message":"sk-live-SECRET"}}', { status: 401 }),
      now: stepClock(),
    });
    expect(s.status).toBe("failed");
    expect(s.error?.code).toBe("auth");
    expect(s.error?.safeMessage).toBe("凭证被上游拒绝");
    expect(s.error?.safeMessage).not.toContain("SECRET");
  });

  it("302 重定向：failed / proxy-policy（redirect: manual）", async () => {
    const s = await runSample(REQ, {
      protocol: "openai",
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://elsewhere.example/" },
        }),
      now: stepClock(),
    });
    expect(s.status).toBe("failed");
    expect(s.error?.code).toBe("proxy-policy");
  });

  it("网络/CORS 失败（fetch TypeError）：failed / cors/network", async () => {
    const s = await runSample(REQ, {
      protocol: "openai",
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
      now: stepClock(),
    });
    expect(s.status).toBe("failed");
    expect(s.error?.code).toBe("cors/network");
  });

  it("非法 JSON data：failed / protocol/parse（不静默成功）", async () => {
    const s = await runSample(REQ, {
      protocol: "anthropic",
      fetchImpl: async () => sseResponse("data: {not json\n\n"),
      now: stepClock(),
    });
    expect(s.status).toBe("failed");
    expect(s.error?.code).toBe("protocol/parse");
  });

  it("用户取消：cancelled（signal aborted）", async () => {
    const user = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":"partial"}}\n\n'));
        user.signal.addEventListener("abort", () => {
          c.error(new DOMException("aborted", "AbortError"));
        });
      },
    });
    const s = runSample(REQ, {
      protocol: "anthropic",
      fetchImpl: async (_url, init) => {
        // 联动：组合 signal abort → 流错误
        init?.signal?.addEventListener("abort", () => user.abort());
        return new Response(stream, { status: 200 });
      },
      now: stepClock(),
      signal: user.signal,
    });
    // 给流一个被消费的机会后取消
    await new Promise((r) => setTimeout(r, 20));
    user.abort();
    const result = await s;
    expect(result.status).toBe("cancelled");
    expect(result.error?.code).toBe("cancelled");
  });

  it("超时：failed / timeout（timeoutMs 到期）", async () => {
    const s = await runSample(REQ, {
      protocol: "anthropic",
      fetchImpl: async (_url, init) => {
        const signal = init?.signal;
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            // 永不产出数据：reader.read() 一直 pending，直到超时 abort 把流打错
            signal?.addEventListener("abort", () => {
              c.error(new DOMException("aborted", "AbortError"));
            });
          },
        });
        return new Response(stream, { status: 200 });
      },
      now: stepClock(),
      timeoutMs: 50,
    });
    expect(s.status).toBe("failed");
    expect(s.error?.code).toBe("timeout");
  }, 15_000);
});

describe("runBenchmark", () => {
  it("3 样本 2 成功 1 失败 → partial；progress 回调 3 次", async () => {
    let calls = 0;
    const progress: number[] = [];
    const run = await runBenchmark(REQ, {
      protocol: "anthropic",
      samples: 3,
      profile: PROFILE_META,
      transport: "browser-direct",
      now: stepClock(),
      fetchImpl: async () => {
        calls++;
        if (calls === 2) return sseResponse(ANTHROPIC_EMPTY_STREAM);
        return sseResponse(ANTHROPIC_STREAM);
      },
      onProgress: ({ index }) => progress.push(index),
    });
    expect(run.status).toBe("partial");
    expect(run.successCount).toBe(2);
    expect(run.requestedSamples).toBe(3);
    expect(progress).toEqual([1, 2, 3]);
    expect(run.schemaVersion).toBe(2);
    expect(run.profile.promptSha256).toBe(CPB_STANDARD_PROFILE.promptSha256);
  });

  it("取消后停止后续样本：status cancelled，fetch 只调 1 次", async () => {
    let calls = 0;
    const user = new AbortController();
    const run = await runBenchmark(REQ, {
      protocol: "anthropic",
      samples: 3,
      profile: PROFILE_META,
      transport: "browser-direct",
      now: stepClock(),
      fetchImpl: async () => {
        calls++;
        return sseResponse(ANTHROPIC_STREAM);
      },
      signal: user.signal,
      onProgress: () => user.abort(),
    });
    expect(run.status).toBe("cancelled");
    expect(calls).toBe(1);
    expect(run.samples).toHaveLength(1);
  });

  it("samples 只允许 1/3/5", async () => {
    await expect(
      runBenchmark(REQ, {
        protocol: "anthropic",
        samples: 4,
        profile: PROFILE_META,
        transport: "browser-direct",
        fetchImpl: async () => sseResponse(ANTHROPIC_STREAM),
      }),
    ).rejects.toThrow(/1\/3\/5/);
  });

  it("全部样本无事件（空流×3）→ failed；聚合指标 null", async () => {
    const run = await runBenchmark(REQ, {
      protocol: "anthropic",
      samples: 3,
      profile: PROFILE_META,
      transport: "tauri-local",
      now: stepClock(),
      fetchImpl: async () => sseResponse(ANTHROPIC_EMPTY_STREAM),
    });
    expect(run.status).toBe("failed");
    expect(run.successCount).toBe(0);
    expect(run.aggregate.ttftMs).toBeNull();
    expect(run.aggregate.tps).toBeNull();
  });
});
