// Hono 后端（同构：Cloudflare Worker + Node 都能跑）
// 唯一职责：接收前端测速请求 → 调 engine → 返回指标
// key 不存储不 log，请求结束即弃

import { Hono } from "hono";
import { cors } from "hono/cors";
import { bench, benchMedian } from "../engine/bench";
import type { BenchInput, Protocol } from "../engine/types";

interface BenchRequestBody {
  endpoint: string;
  apiKey: string;
  model: string;
  protocol: Protocol;
  prompt?: string;
  maxTokens?: number;
  samples?: number; // >1 时跑多次取中位数
}

const app = new Hono();

// 允许前端跨域调本后端（网站前端和后端可能不同域）
app.use("/api/*", cors());

app.post("/api/bench", async (c) => {
  let body: BenchRequestBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "请求体必须是 JSON" }, 400);
  }

  const { endpoint, apiKey, model, protocol } = body;
  if (!endpoint || !apiKey || !model || !protocol) {
    return c.json(
      { error: "缺少必填字段：endpoint / apiKey / model / protocol" },
      400,
    );
  }
  if (protocol !== "anthropic" && protocol !== "openai") {
    return c.json({ error: "protocol 必须是 anthropic 或 openai" }, 400);
  }

  const input: BenchInput = {
    endpoint,
    apiKey,
    model,
    protocol,
    prompt: body.prompt || "Reply exactly: OK",
    maxTokens: body.maxTokens ?? 512,
    timeoutMs: 90_000,
  };

  // 单次 or 多次取样
  if (body.samples && body.samples > 1) {
    const r = await benchMedian(input, body.samples);
    return c.json({
      ...r,
      samples: body.samples,
      success: r.successCount > 0,
    });
  }

  const r = await bench(input);
  return c.json({
    ttft: r.ttft,
    total: r.total,
    outputTokens: r.outputTokens,
    inputTokens: r.inputTokens,
    thinkingMs: r.thinkingMs,
    success: r.success,
    error: r.error,
    samples: 1,
  });
});

app.get("/api/health", (c) => c.json({ ok: true }));

// 导出 app：Worker 入口(src/worker.ts) 和 Node 入口(server/node.ts) 共用
export { app };
