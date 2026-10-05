// T-005 协议集成测试（AC-005）：完整 Request URL 被原样请求一次；
// 构造出的协议请求经 mock upstream 捕获，与 fixture 逐字段一致。
import { describe, expect, it } from "vitest";
import { buildProtocolRequest } from "../../engine/request";
import { runSample } from "../../engine/bench";
import { CPB_STANDARD_PROFILE } from "../../engine/profiles";
import { ANTHROPIC_STREAM, OPENAI_STREAM } from "../fixtures/sse";

function stepClock() {
  let t = 0;
  return () => (t += 10);
}

function sseResponse(text: string): Response {
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
  });
}

describe("URL 原样一次（AC-005）", () => {
  const cases = [
    { protocol: "anthropic" as const, url: "https://open.bigmodel.cn/api/anthropic/v1/messages", stream: ANTHROPIC_STREAM },
    { protocol: "openai" as const, url: "https://api.openai.com/v1/chat/completions", stream: OPENAI_STREAM },
  ];

  for (const { protocol, url, stream } of cases) {
    it(`${protocol}：mock upstream 收到完整 URL 一次、无追加`, async () => {
      const seen: Array<{ url: string; init: RequestInit }> = [];
      const req = buildProtocolRequest({
        requestUrl: url,
        apiKey: "k-test",
        model: "m-test",
        protocol,
        profile: CPB_STANDARD_PROFILE,
      });
      const s = await runSample(req, {
        protocol,
        fetchImpl: async (input, init) => {
          seen.push({ url: String(input), init: init ?? { method: "POST" } });
          return sseResponse(stream);
        },
        now: stepClock(),
      });
      expect(seen).toHaveLength(1);
      expect(seen[0]!.url).toBe(url);
      expect(seen[0]!.init.method).toBe("POST");
      expect(seen[0]!.init.redirect).toBe("manual");
      expect(s.status).toBe("complete");
    });
  }
});

describe("协议请求 fixture 一致", () => {
  it("anthropic 请求 headers/body 逐字段一致", async () => {
    let captured: { url: string; headers: Record<string, string>; body: string } | null =
      null;
    const req = buildProtocolRequest({
      requestUrl: "https://api.anthropic.com/v1/messages",
      apiKey: "sk-ant-test",
      model: "claude-x",
      protocol: "anthropic",
      profile: CPB_STANDARD_PROFILE,
    });
    await runSample(req, {
      protocol: "anthropic",
      fetchImpl: async (input, init) => {
        captured = {
          url: String(input),
          headers: (init?.headers ?? {}) as Record<string, string>,
          body: String(init?.body ?? ""),
        };
        return sseResponse(ANTHROPIC_STREAM);
      },
      now: stepClock(),
    });
    expect(captured).not.toBeNull();
    const c = captured!;
    expect(c.url).toBe("https://api.anthropic.com/v1/messages");
    expect(c.headers["anthropic-version"]).toBe("2023-06-01");
    expect(c.headers["x-api-key"]).toBe("sk-ant-test");
    const body = JSON.parse(c.body);
    expect(body.model).toBe("claude-x");
    expect(body.stream).toBe(true);
    expect(body.messages[0].content).toBe(CPB_STANDARD_PROFILE.prompt);
  });

  it("openai 请求不含 anthropic 头，body 含 include_usage", async () => {
    let captured: { headers: Record<string, string>; body: string } | null = null;
    const req = buildProtocolRequest({
      requestUrl: "https://api.deepseek.example/chat/completions",
      apiKey: "sk-oai-test",
      model: "deepseek-x",
      protocol: "openai",
      profile: CPB_STANDARD_PROFILE,
    });
    await runSample(req, {
      protocol: "openai",
      fetchImpl: async (_input, init) => {
        captured = {
          headers: (init?.headers ?? {}) as Record<string, string>,
          body: String(init?.body ?? ""),
        };
        return sseResponse(ANTHROPIC_STREAM); // 协议映射无关紧要，只验证请求侧
      },
      now: stepClock(),
    });
    const c = captured!;
    expect(c.headers["x-api-key"]).toBeUndefined();
    expect(c.headers.Authorization).toBe("Bearer sk-oai-test");
    expect(JSON.parse(c.body).stream_options).toEqual({ include_usage: true });
  });
});
