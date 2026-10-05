// T-005 代理安全集成测试（AC-004）：危险矩阵全部在发起上游请求前拒绝，
// mock upstream 调用数为 0；合法路径放行且响应/日志不含 Key 与上游 body。
import { describe, expect, it } from "vitest";
import { createApp } from "../../server/index";
import type { ServerConfig } from "../../server/config";
import { ANTHROPIC_STREAM } from "../fixtures/sse";

const CONFIG: ServerConfig = {
  corsAllowedOrigins: ["https://bench.example", "http://localhost:5173"],
  allowedUpstreams: [
    { host: "api.anthropic.com", pathPrefix: "/v1/messages" },
    { host: "open.bigmodel.cn", pathPrefix: "/api/anthropic/v1/messages" },
  ],
  maxBodyBytes: 16 * 1024,
  hardTimeoutMs: 300_000,
};

const ORIGIN = "https://bench.example";
const API_KEY = "sk-test-KEYMATERIAL-do-not-leak";

/** mock upstream：记录调用次数，返回正常 anthropic SSE */
function makeUpstream() {
  const state = { calls: 0, lastUrl: "" };
  const fetchImpl: typeof fetch = async (input) => {
    state.calls += 1;
    state.lastUrl = String(input);
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
  };
  return { state, fetchImpl };
}

function validBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requestUrl: "https://api.anthropic.com/v1/messages",
    apiKey: API_KEY,
    model: "claude-test",
    protocol: "anthropic",
    profileId: "cpb-standard",
    profileVersion: 1,
    samples: 1,
    ...over,
  };
}

async function post(
  app: ReturnType<typeof createApp>,
  body: unknown,
  opts: { origin?: string | null; raw?: string; contentType?: string } = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": opts.contentType ?? "application/json",
  };
  if (opts.origin !== null) headers.Origin = opts.origin ?? ORIGIN;
  return app.request("/api/bench", {
    method: "POST",
    headers,
    body: opts.raw ?? JSON.stringify(body),
  });
}

describe("危险 URL 矩阵：全部拒绝且 upstream 0 次调用", () => {
  const dangerous: Array<{ name: string; url: string }> = [
    { name: "HTTP 协议", url: "http://api.anthropic.com/v1/messages" },
    { name: "URL credentials", url: "https://user:pass@api.anthropic.com/v1/messages" },
    { name: "fragment", url: "https://api.anthropic.com/v1/messages#x" },
    { name: "非 443 端口", url: "https://api.anthropic.com:8443/v1/messages" },
    { name: "IPv4 literal", url: "https://169.254.169.254/v1/messages" },
    { name: "IPv6 literal", url: "https://[::1]/v1/messages" },
    { name: "十六进制 IP literal", url: "https://0x7f000001/v1/messages" },
    { name: "localhost", url: "https://localhost/v1/messages" },
    { name: ".local 名", url: "https://evil.local/v1/messages" },
    { name: "未知 host", url: "https://api.unknown.example/v1/messages" },
    { name: "suffix 欺骗 host", url: "https://evil-api.anthropic.com/v1/messages" },
    { name: "allowlist host 但 path 越界", url: "https://api.anthropic.com/admin/secret" },
    { name: "allowlist host 但 path 前缀伪造", url: "https://api.anthropic.com/v1/messages-evil/x" },
  ];

  for (const { name, url } of dangerous) {
    it(`${name} → 4xx，upstream 0 次`, async () => {
      const up = makeUpstream();
      const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
      const res = await post(app, validBody({ requestUrl: url }));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toMatch(/INVALID_REQUEST|UPSTREAM_NOT_ALLOWED/);
      expect(up.state.calls).toBe(0);
    });
  }
});

describe("字段与体积上限", () => {
  it("samples=7 → 400，upstream 0 次", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const res = await post(app, validBody({ samples: 7 }));
    expect(res.status).toBe(400);
    expect(up.state.calls).toBe(0);
  });

  it("samples=2 → 400", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const res = await post(app, validBody({ samples: 2 }));
    expect(res.status).toBe(400);
  });

  it("伪造 profileId/version → 400（客户端不能自带 prompt/maxTokens）", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const res = await post(
      app,
      validBody({ profileId: "cpb-standard", profileVersion: 99 }),
    );
    expect(res.status).toBe(400);
    const res2 = await post(
      app,
      validBody({ profileId: "my-own", profileVersion: 1, prompt: "steal" }),
    );
    expect(res2.status).toBe(400);
    expect(up.state.calls).toBe(0);
  });

  it("apiKey 缺失 / 超长 → 400", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    expect((await post(app, validBody({ apiKey: "" }))).status).toBe(400);
    expect(
      (await post(app, validBody({ apiKey: "x".repeat(513) }))).status,
    ).toBe(400);
  });

  it("model 超长 → 400", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    expect(
      (await post(app, validBody({ model: "m".repeat(129) }))).status,
    ).toBe(400);
  });

  it("body > 16KiB → 413 BODY_TOO_LARGE", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const big = validBody({ model: "x".repeat(17 * 1024) });
    const res = await post(app, big);
    expect(res.status).toBe(413);
    expect(up.state.calls).toBe(0);
  });

  it("非 JSON Content-Type → 400", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const res = await post(app, validBody(), { contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("非法 JSON body → 400", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const res = await post(app, null, { raw: "{not json" });
    expect(res.status).toBe(400);
  });
});

describe("Origin 门禁", () => {
  it("Origin 不在 allowlist → 403 ORIGIN_NOT_ALLOWED，upstream 0 次", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const res = await post(app, validBody(), { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(up.state.calls).toBe(0);
  });

  it("无 Origin 的 POST（curl）→ 403（显式规则：非浏览器客户端不得调用计费 API）", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const res = await post(app, validBody(), { origin: null });
    expect(res.status).toBe(403);
    expect(up.state.calls).toBe(0);
  });

  it("allowlist Origin 的 CORS 头精确回显 + Vary", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const res = await post(app, validBody());
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Vary")).toContain("Origin");
  });

  it("health 无 Origin 也 200（只读探活），不泄露 allowlist", async () => {
    const app = createApp({ config: CONFIG });
    const res = await app.request("/api/health", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ready).toBe(true);
    expect(JSON.stringify(body)).not.toContain("anthropic");
    expect(JSON.stringify(body)).not.toContain("bigmodel");
  });
});

describe("合法路径与脱敏", () => {
  it("allowlist 内合法请求 → 200 BenchmarkRunResult + request-id + no-store + upstream 恰 1 次", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const res = await post(app, validBody());
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const run = (await res.json()) as {
      schemaVersion: number;
      transport: string;
      status: string;
      successCount: number;
    };
    expect(run.schemaVersion).toBe(2);
    expect(run.transport).toBe("trusted-proxy");
    expect(run.status).toBe("complete");
    expect(run.successCount).toBe(1);
    expect(up.state.calls).toBe(1);
    // 上游收到的是原样 URL（不追加 path）
    expect(up.state.lastUrl).toBe("https://api.anthropic.com/v1/messages");
  });

  it("响应 body 与 headers 不含 Key", async () => {
    const up = makeUpstream();
    const app = createApp({ config: CONFIG, fetchImpl: up.fetchImpl });
    const res = await post(app, validBody());
    const text = JSON.stringify(await res.json()) + JSON.stringify(Object.fromEntries(res.headers.entries()));
    expect(text).not.toContain(API_KEY);
  });

  it("上游 401 → 200 failed run，error.code=auth，不回显上游 body", async () => {
    const up = makeUpstream();
    const upstreamSecret = "UPSTREAM-BODY-SECRET";
    const app = createApp({
      config: CONFIG,
      fetchImpl: async () =>
        new Response(`{"error":{"message":"${upstreamSecret}"}}`, { status: 401 }),
    });
    void up;
    const res = await post(app, validBody());
    expect(res.status).toBe(200);
    const run = (await res.json()) as { status: string; samples: Array<{ error?: { code?: string; safeMessage?: string } }> };
    expect(run.status).toBe("failed");
    expect(run.samples[0]?.error?.code).toBe("auth");
    expect(JSON.stringify(run)).not.toContain(upstreamSecret);
  });

  it("上游 302 → 样本 failed/proxy-policy，响应不含 location", async () => {
    const app = createApp({
      config: CONFIG,
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://evil.example/steal" },
        }),
    });
    const res = await post(app, validBody());
    expect(res.status).toBe(200);
    const run = (await res.json()) as { samples: Array<{ error?: { code?: string } }> };
    expect(run.samples[0]?.error?.code).toBe("proxy-policy");
    expect(JSON.stringify(run)).not.toContain("evil.example");
  });

  it("上游网络故障 → 502 UPSTREAM_FAILED（安全摘要）", async () => {
    const app = createApp({
      config: CONFIG,
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const res = await post(app, validBody());
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("UPSTREAM_FAILED");
  });

  it("DNS 解析到私网（注入 dnsLookup 的部署）→ 403", async () => {
    const up = makeUpstream();
    const app = createApp({
      config: CONFIG,
      fetchImpl: up.fetchImpl,
      dnsLookup: async () => ["10.0.0.5"],
    });
    const res = await post(app, validBody());
    expect(res.status).toBe(403);
    expect(up.state.calls).toBe(0);
  });
});
