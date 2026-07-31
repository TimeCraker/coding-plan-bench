// 调测速 API：浏览器直调优先 → Worker/服务器回退
// 策略：开 CORS 的 endpoint 浏览器直连（不经服务器，最安全）；失败回退到后端代理

import type { Protocol } from "../../../engine/types";

export interface BenchApiResponse {
  ttft: number;
  total: number;
  outputTokens: number;
  inputTokens?: number;
  thinkingMs?: number;
  success: boolean;
  error?: string;
  samples: number;
}

interface BenchParams {
  endpoint: string;
  apiKey: string;
  model: string;
  protocol: Protocol;
  prompt?: string;
  maxTokens?: number;
  samples?: number;
}

/** 后端代理地址（Worker 或自服务器，可通过环境变量配） */
const API_BASE =
  (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE ||
  "/api"; // 默认同源（Pages 部署时通过 _redirects 或 Worker routes 代理）

/** 构造直调请求体 */
function buildDirectBody(p: BenchParams) {
  const base = `${p.endpoint.replace(/\/$/, "")}`;
  const url =
    p.protocol === "anthropic"
      ? `${base}/v1/messages`
      : `${base}/v1/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${p.apiKey}`,
  };
  if (p.protocol === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
    headers["x-api-key"] = p.apiKey;
  }
  const body =
    p.protocol === "anthropic"
      ? {
          model: p.model,
          max_tokens: p.maxTokens ?? 512,
          temperature: 0,
          stream: true,
          messages: [{ role: "user", content: p.prompt || "Reply exactly: OK" }],
        }
      : {
          model: p.model,
          max_tokens: p.maxTokens ?? 512,
          temperature: 0,
          stream: true,
          stream_options: { include_usage: true },
          messages: [{ role: "user", content: p.prompt || "Reply exactly: OK" }],
        };
  return { url, headers, body: JSON.stringify(body) };
}

/** 浏览器直调（流式采集，复用 engine 逻辑） */
async function benchDirect(p: BenchParams): Promise<BenchApiResponse> {
  const { bench } = await import("../../../engine/bench");
  const r = await bench({
    endpoint: p.endpoint,
    apiKey: p.apiKey,
    model: p.model,
    protocol: p.protocol,
    prompt: p.prompt,
    maxTokens: p.maxTokens,
    timeoutMs: 90_000,
  });
  return {
    ttft: r.ttft,
    total: r.total,
    outputTokens: r.outputTokens,
    inputTokens: r.inputTokens,
    thinkingMs: r.thinkingMs,
    success: r.success,
    error: r.error,
    samples: 1,
  };
}

/** 经后端代理（Worker/服务器） */
async function benchProxy(p: BenchParams): Promise<BenchApiResponse> {
  const res = await fetch(`${API_BASE}/bench`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: p.endpoint,
      apiKey: p.apiKey,
      model: p.model,
      protocol: p.protocol,
      prompt: p.prompt,
      maxTokens: p.maxTokens,
      samples: p.samples,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`代理请求失败 ${res.status}: ${t.slice(0, 120)}`);
  }
  return (await res.json()) as BenchApiResponse;
}

/**
 * 测速：先浏览器直调，CORS 失败回退后端代理。
 * 多次取样时走代理（代理支持 samples 参数）。
 */
export async function runBench(
  p: BenchParams,
  onStage?: (stage: "direct" | "proxy") => void,
): Promise<BenchApiResponse> {
  // 多次取样直接走代理（直调只跑单次）
  if (p.samples && p.samples > 1) {
    onStage?.("proxy");
    return benchProxy(p);
  }
  // 单次：先直调
  try {
    onStage?.("direct");
    return await benchDirect(p);
  } catch (e) {
    // CORS 或网络失败 → 回退代理
    onStage?.("proxy");
    try {
      return await benchProxy({ ...p, samples: 1 });
    } catch {
      throw e;
    }
  }
}
