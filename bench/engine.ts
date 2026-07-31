// 测速引擎核心：用 Anthropic 兼容 SSE 流式调用，采集 TTFT / TPS / Total
// 零运行时依赖（Node 18+ 原生 fetch + ReadableStream），只读 .env

import type { ProviderConfig, Sample } from "./types";
import { BENCH_PARAMS } from "./prompts";

interface BenchCallResult {
  ttft: number;
  total: number;
  outputTokens: number;
  inputTokens: number;
  text: string;
}

/**
 * 对一家 provider 发起一次流式请求，采集首 token 时间与输出速度。
 * 协议：Anthropic Messages API (SSE)。
 */
export async function benchOnce(
  provider: ProviderConfig,
  prompt: string,
): Promise<BenchCallResult> {
  const apiKey = process.env[provider.envVar];
  if (!apiKey) {
    throw new Error(`环境变量 ${provider.envVar} 未设置（见 .env.example）`);
  }

  const url = `${provider.endpoint}/v1/messages`;
  const body = {
    model: provider.model,
    max_tokens: BENCH_PARAMS.maxTokens,
    temperature: BENCH_PARAMS.temperature,
    stream: true,
    messages: [{ role: "user", content: prompt }],
  };

  const t0 = performance.now();
  let ttft = 0;
  let outputTokens = 0;
  let inputTokens = 0;
  let text = "";

  // 超时保护：单个请求最多 90s，防止流不结束导致整体 hang
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  if (!res.ok || !res.body) {
    clearTimeout(timeout);
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  // 解析 SSE 流：data: {...}\n\n
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 按 SSE 事件分割
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = event.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      if (!json || json === "[DONE]") continue;

      try {
        const evt = JSON.parse(json);
        // 首 token：第一个 content_block_delta（无论 text 还是 thinking 都算首输出）
        if (ttft === 0 && evt.type === "content_block_delta" && (evt.delta?.text || evt.delta?.thinking)) {
          ttft = performance.now() - t0;
        }
        // 累积正文与思考
        if (evt.type === "content_block_delta" && evt.delta?.text) {
          text += evt.delta.text;
        }
        // usage：message_start 带 input，message_delta 带 output
        if (evt.type === "message_start" && evt.message?.usage) {
          if (typeof evt.message.usage.input_tokens === "number") inputTokens = evt.message.usage.input_tokens;
        }
        if (evt.usage) {
          if (typeof evt.usage.input_tokens === "number" && !inputTokens) inputTokens = evt.usage.input_tokens;
          if (typeof evt.usage.output_tokens === "number") outputTokens = evt.usage.output_tokens;
        }
      } catch {
        // 非 JSON 心跳，忽略
      }
    }
  }

  const total = performance.now() - t0;
  clearTimeout(timeout);
  // 若流式 usage 缺失，按文本粗估 output tokens（中英文 ~1.5 字/token，保守 2）
  if (outputTokens === 0 && text) {
    outputTokens = Math.max(1, Math.round(text.length / 2));
  }

  return { ttft, total, outputTokens, inputTokens, text };
}

/**
 * 跑一次完整测速：provider × prompt × N samples。
 * 返回 Sample 列表。
 */
export async function benchProviderPrompt(
  provider: ProviderConfig,
  promptId: string,
  prompt: string,
  samples: number,
  onProgress?: (run: number, sample: Sample) => void,
): Promise<Sample[]> {
  const results: Sample[] = [];
  for (let run = 1; run <= samples; run++) {
    const sample: Sample = {
      provider: provider.id,
      promptId,
      run,
      ttft: 0,
      tps: 0,
      total: 0,
      outputTokens: 0,
      inputTokens: 0,
      success: false,
    };
    try {
      const r = await benchOnce(provider, prompt);
      sample.ttft = Math.round(r.ttft);
      sample.total = Math.round(r.total);
      sample.outputTokens = r.outputTokens;
      sample.inputTokens = r.inputTokens;
      // TPS = output tokens / (总耗时 - 首 token) 秒；若 total<=ttft 用 total
      const genMs = Math.max(1, r.total - r.ttft);
      sample.tps = Math.round((r.outputTokens / genMs) * 1000 * 10) / 10;
      sample.success = true;
    } catch (e) {
      sample.error = e instanceof Error ? e.message : String(e);
      sample.success = false;
    }
    results.push(sample);
    onProgress?.(run, sample);
  }
  return results;
}
