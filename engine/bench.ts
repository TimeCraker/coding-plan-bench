// 同构测速引擎核心：发请求 → SSE 流式 → 采集 TTFT/TPS/Total
// 运行时无关（Node / Worker / 浏览器 fetch 都能用）
// 支持 Anthropic Messages API 和 OpenAI Chat Completions 两种协议

import type { BenchInput, BenchResult, Protocol } from "./types";
import { iterSSEEvents } from "./parse-sse";

const DEFAULTS = {
  maxTokens: 512,
  temperature: 0,
  timeoutMs: 90_000,
  prompt: "Reply exactly: OK",
};

/** 构造请求 URL + body + headers */
function buildRequest(input: BenchInput): {
  url: string;
  body: string;
  headers: Record<string, string>;
} {
  const maxTokens = input.maxTokens ?? DEFAULTS.maxTokens;
  const temperature = input.temperature ?? DEFAULTS.temperature;
  const prompt = input.prompt || DEFAULTS.prompt;

  if (input.protocol === "anthropic") {
    return {
      url: `${input.endpoint.replace(/\/$/, "")}/v1/messages`,
      body: JSON.stringify({
        model: input.model,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        Authorization: `Bearer ${input.apiKey}`,
        "x-api-key": input.apiKey,
      },
    };
  }

  // openai 协议
  return {
    url: `${input.endpoint.replace(/\/$/, "")}/v1/chat/completions`,
    body: JSON.stringify({
      model: input.model,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      stream_options: { include_usage: true },
      messages: [{ role: "user", content: prompt }],
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
  };
}

/** 解析单个 SSE 事件，提取首 token / 文本 / usage */
interface ParseAccumulator {
  ttft: number;
  outputTokens: number;
  inputTokens: number;
  text: string;
  thinkingEnd: number; // 思考阶段结束时间戳
  firstEventTime: number;
}

function makeAccumulator(): ParseAccumulator {
  return {
    ttft: 0,
    outputTokens: 0,
    inputTokens: 0,
    text: "",
    thinkingEnd: 0,
    firstEventTime: 0,
  };
}

/** 处理一个 SSE 事件，更新累加器 */
function handleEvent(
  evt: Record<string, unknown>,
  protocol: Protocol,
  acc: ParseAccumulator,
  now: () => number,
): void {
  if (acc.firstEventTime === 0) acc.firstEventTime = now();

  if (protocol === "anthropic") {
    handleAnthropicEvent(evt, acc, now);
  } else {
    handleOpenAIEvent(evt, acc, now);
  }
}

function handleAnthropicEvent(
  evt: Record<string, unknown>,
  acc: ParseAccumulator,
  now: () => number,
): void {
  const type = evt.type as string | undefined;
  const delta = evt.delta as Record<string, unknown> | undefined;

  // 首 token：第一个 content_block_delta（thinking 或 text 都算首输出）
  if (
    acc.ttft === 0 &&
    type === "content_block_delta" &&
    (delta?.text || delta?.thinking)
  ) {
    acc.ttft = now();
  }

  // 正文累积
  if (type === "content_block_delta" && typeof delta?.text === "string") {
    acc.text += delta.text;
    acc.thinkingEnd = now(); // 正文开始，思考结束
  }

  // usage
  const msgUsage = (evt.message as Record<string, unknown>)?.usage as
    | Record<string, unknown>
    | undefined;
  if (type === "message_start" && msgUsage) {
    if (typeof msgUsage.input_tokens === "number")
      acc.inputTokens = msgUsage.input_tokens;
  }
  if (evt.usage) {
    const u = evt.usage as Record<string, unknown>;
    if (typeof u.input_tokens === "number" && !acc.inputTokens)
      acc.inputTokens = u.input_tokens;
    if (typeof u.output_tokens === "number")
      acc.outputTokens = u.output_tokens;
  }
}

function handleOpenAIEvent(
  evt: Record<string, unknown>,
  acc: ParseAccumulator,
  now: () => number,
): void {
  const choices = evt.choices as Array<Record<string, unknown>> | undefined;
  const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;

  // 首 token：第一个有内容的 delta
  if (acc.ttft === 0 && delta && (delta.content || delta.reasoning_content)) {
    acc.ttft = now();
  }

  // 正文累积
  if (delta && typeof delta.content === "string") {
    acc.text += delta.content;
    acc.thinkingEnd = now();
  }

  // usage（stream_options.include_usage）
  if (evt.usage) {
    const u = evt.usage as Record<string, unknown>;
    if (typeof u.prompt_tokens === "number")
      acc.inputTokens = u.prompt_tokens;
    if (typeof u.completion_tokens === "number")
      acc.outputTokens = u.completion_tokens;
  }
}

/**
 * 执行一次测速。运行时无关——传入 fetch 即可（默认用全局 fetch）。
 * 返回 BenchResult。
 */
export async function bench(
  input: BenchInput,
  options?: {
    fetchImpl?: typeof fetch;
    now?: () => number;
  },
): Promise<BenchResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const now = options?.now ?? (() => performance.now());
  const timeoutMs = input.timeoutMs ?? DEFAULTS.timeoutMs;

  const { url, body, headers } = buildRequest(input);

  const t0 = now();
  const acc = makeAccumulator();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    for await (const evt of iterSSEEvents(res.body)) {
      handleEvent(evt, input.protocol, acc, now);
    }

    const total = now() - t0;
    clearTimeout(timeout);

    // usage 缺失时按文本粗估 output tokens
    let outputTokens = acc.outputTokens;
    if (outputTokens === 0 && acc.text) {
      outputTokens = Math.max(1, Math.round(acc.text.length / 2));
    }

    // 思考耗时：若 thinkingEnd 晚于 ttft，说明有思考阶段
    const thinkingMs =
      acc.thinkingEnd > acc.ttft ? Math.round(acc.thinkingEnd - acc.ttft) : 0;

    return {
      ttft: Math.round(acc.ttft - t0),
      total: Math.round(total),
      outputTokens,
      inputTokens: acc.inputTokens,
      text: acc.text,
      thinkingMs,
      success: true,
    };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ttft: 0,
      total: Math.round(now() - t0),
      outputTokens: 0,
      inputTokens: 0,
      text: "",
      thinkingMs: 0,
      success: false,
      error: msg.includes("aborted") ? `请求超时（${timeoutMs / 1000}s）` : msg,
    };
  }
}

/**
 * 跑 N 次取样，返回中位数结果。
 * 用于网站/本地多取样场景。
 */
export async function benchMedian(
  input: BenchInput,
  samples: number,
  onProgress?: (run: number, result: BenchResult) => void,
): Promise<{
  ttft: number;
  tps: number;
  total: number;
  outputTokens: number;
  successCount: number;
}> {
  const results: BenchResult[] = [];
  for (let run = 1; run <= samples; run++) {
    const r = await bench(input);
    results.push(r);
    onProgress?.(run, r);
  }
  const ok = results.filter((r) => r.success);
  if (!ok.length) {
    return {
      ttft: 0,
      tps: 0,
      total: 0,
      outputTokens: 0,
      successCount: 0,
    };
  }
  const med = (nums: number[]) => {
    const s = [...nums].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  };
  const ttft = med(ok.map((r) => r.ttft));
  const total = med(ok.map((r) => r.total));
  const outputTokens = med(ok.map((r) => r.outputTokens));
  // TPS = output tokens / 生成阶段时长
  const genMs = Math.max(1, total - ttft);
  const tps = Math.round((outputTokens / genMs) * 1000 * 10) / 10;
  return { ttft, tps, total, outputTokens, successCount: ok.length };
}
