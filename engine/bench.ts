// 同构测速引擎编排层：BuiltRequest → Transport fetch → SSE → 协议事件 → 计量 → 聚合。
//
// S01 架构（Spec §3.1）：
// - 请求构造（URL/body/headers）属于 engine/request.ts（T-005），本文件只消费 BuiltRequest
// - runSample：单样本（fetch → iterSSEFrames → adapter → measurement reducer → SampleResult）
// - runBenchmark：串行多样本 + progress + AbortSignal + 聚合（complete/partial/failed/cancelled）
//
// v1 兼容壳 bench()/benchMedian() 保留给 bench/ CLI 与旧 server（T-005/T-006 迁移调用方），
// 语义已切换到新计量（字符估算 token 已删除、CRLF/空流/取消语义修复）。

import type {
  BenchInput,
  BenchResult,
  BenchmarkRunResult,
  Protocol,
  ProtocolEvent,
  SampleResult,
  TransportKind,
} from "./types";
import { isSampleCount } from "./types";
import { iterSSEFrames } from "./parse-sse";
import { getProtocolAdapter, ProtocolParseError } from "./protocols";
import {
  applyEvent,
  createMeasurementState,
  finalizeSample,
} from "./measurement";
import { aggregateRun } from "./aggregate";
import {
  codeFromFetchError,
  codeFromHttpStatus,
  sanitizeMessage,
} from "./errors";
import { sha256Hex } from "./profiles";

// ───────────────────────── 新引擎 API ─────────────────────────

/** 已构造好的协议请求（由 engine/request.ts 产出；本层原样使用，不改 URL） */
export interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface RunSampleOptions {
  protocol: Protocol;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** 用户取消信号（cancelled 语义） */
  signal?: AbortSignal;
  /** 单样本墙钟上限 ms（超时 → failed/timeout） */
  timeoutMs?: number;
  /** 事件观察钩子（v1 CLI 兼容层收集正文用；不影响计量） */
  onEvent?: (ev: ProtocolEvent, at: number) => void;
}

function isAbortError(e: unknown): boolean {
  return (
    e instanceof Error && e.name === "AbortError"
  );
}

/** 组合多个 signal（不依赖 AbortSignal.any，兼容旧运行时） */
function combineSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort();
      break;
    }
    s.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

function failedSampleResult(
  requestStart: number,
  streamEnd: number,
  code: string,
  safeMessage: string,
): SampleResult {
  return {
    status: "failed",
    ttftMs: null,
    thinkingMs: null,
    generationMs: null,
    totalMs: Math.max(0, Math.round(streamEnd - requestStart)),
    outputTokens: null,
    inputTokens: null,
    tps: null,
    tokenSource: "unavailable",
    error: { code, safeMessage },
  };
}

/** 执行单个样本：全链路纯注入（fetch/now/signal），无全局依赖。 */
export async function runSample(
  req: BuiltRequest,
  opts: RunSampleOptions,
): Promise<SampleResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => performance.now());
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const adapter = getProtocolAdapter(opts.protocol);

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signals: AbortSignal[] = [timeoutController.signal];
  if (opts.signal) signals.push(opts.signal);
  const signal = combineSignals(signals);

  const requestStart = now();
  const state = createMeasurementState(requestStart);

  try {
    const res = await fetchImpl(req.url, {
      method: "POST",
      headers: req.headers,
      body: req.body,
      signal,
      redirect: "manual",
    });

    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      return failedSampleResult(
        requestStart,
        now(),
        "proxy-policy",
        "上游返回重定向，已拒绝跟随",
      );
    }

    if (!res.ok) {
      // 不读取/不回显上游错误 body（AUD-011）
      const code = codeFromHttpStatus(res.status);
      return failedSampleResult(
        requestStart,
        now(),
        code,
        code === "auth"
          ? "凭证被上游拒绝"
          : `上游返回 HTTP ${res.status}`,
      );
    }

    if (!res.body) {
      return failedSampleResult(
        requestStart,
        now(),
        "protocol/parse",
        "上游未返回可读的流式响应体",
      );
    }

    for await (const frame of iterSSEFrames(res.body)) {
      for (const ev of adapter.mapDataEvent(frame.data)) {
        const at = now();
        opts.onEvent?.(ev, at);
        applyEvent(state, at, ev);
      }
    }

    return finalizeSample(state, now());
  } catch (e) {
    const streamEnd = now();
    if (isAbortError(e)) {
      if (opts.signal?.aborted) {
        return finalizeSample(state, streamEnd, { cancelled: true });
      }
      return failedSampleResult(
        requestStart,
        streamEnd,
        "timeout",
        `样本超过 ${Math.round(timeoutMs / 1000)}s 墙钟上限`,
      );
    }
    if (e instanceof ProtocolParseError) {
      return failedSampleResult(
        requestStart,
        streamEnd,
        "protocol/parse",
        e.message,
      );
    }
    const code = codeFromFetchError(e, { userCancelled: false });
    return failedSampleResult(
      requestStart,
      streamEnd,
      code,
      code === "cors/network"
        ? "网络或 CORS 失败（浏览器直连被拦截）"
        : sanitizeMessage(e instanceof Error ? e.message : String(e)),
    );
  } finally {
    clearTimeout(timer);
  }
}

export interface RunBenchmarkOptions extends RunSampleOptions {
  samples: number;
  profile: { id: string; version: number; promptSha256: string };
  transport: TransportKind;
  onProgress?: (info: {
    index: number;
    total: number;
    sample: SampleResult;
  }) => void;
}

/**
 * 串行运行多样本并聚合。samples 与 transport 正交（FR-001）；
 * 用户取消后停止后续样本，状态 cancelled，不写任何持久化（持久化由调用方判断状态）。
 */
export async function runBenchmark(
  req: BuiltRequest,
  opts: RunBenchmarkOptions,
): Promise<BenchmarkRunResult> {
  if (!isSampleCount(opts.samples)) {
    throw new Error(`samples 必须是 1/3/5，收到 ${opts.samples}`);
  }
  const samples: SampleResult[] = [];
  let aborted = false;
  for (let i = 0; i < opts.samples; i++) {
    const sample = await runSample(req, opts);
    samples.push(sample);
    opts.onProgress?.({ index: i + 1, total: opts.samples, sample });
    if (opts.signal?.aborted) {
      aborted = true;
      break;
    }
  }
  const run = aggregateRun(samples, {
    profile: opts.profile,
    transport: opts.transport,
    requestedSamples: opts.samples,
  });
  // 用户在样本间隙取消：运行未跑满，整体记 cancelled（不伪装 partial）
  if (aborted && samples.length < opts.samples) {
    return { ...run, status: "cancelled" as const };
  }
  return run;
}

// ───────────────────────── v1 兼容层（bench/ CLI 与旧 server 使用） ─────────────────────────

const V1_DEFAULTS = {
  maxTokens: 512,
  temperature: 0,
  timeoutMs: 90_000,
  prompt: "Reply exactly: OK",
};

/** v1 endpoint 拼接（仅兼容层使用；新链路是完整 Request URL，见 T-005） */
function v1BuildRequest(input: BenchInput): BuiltRequest {
  const maxTokens = input.maxTokens ?? V1_DEFAULTS.maxTokens;
  const temperature = input.temperature ?? V1_DEFAULTS.temperature;
  const prompt = input.prompt || V1_DEFAULTS.prompt;

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

/**
 * v1 单次测速（bench/ CLI 的长期 API）。
 * 计量已切换到新引擎语义：TTFT 只认首个非空正文、thinking 仅 reasoning→text、
 * usage 缺失 outputTokens=0（不再字符估算）、空流 failed、错误不回显上游 body。
 */
export async function bench(
  input: BenchInput,
  options?: {
    fetchImpl?: typeof fetch;
    now?: () => number;
    signal?: AbortSignal;
  },
): Promise<BenchResult> {
  const req = v1BuildRequest(input);
  let text = "";
  let stopReason: string | undefined;
  const sample = await runSample(req, {
    protocol: input.protocol,
    fetchImpl: options?.fetchImpl,
    now: options?.now,
    signal: options?.signal,
    timeoutMs: input.timeoutMs ?? V1_DEFAULTS.timeoutMs,
    onEvent: (ev) => {
      if (ev.type === "text" && ev.text) text += ev.text;
      if (ev.type === "finish") stopReason = ev.stopReason;
    },
  });
  return fromSampleToV1(sample, text, stopReason);
}

/** SampleResult → v1 BenchResult 映射 */
function fromSampleToV1(s: SampleResult, text: string, stopReason?: string): BenchResult {
  return {
    ttft: s.ttftMs ?? 0,
    total: s.totalMs,
    outputTokens: s.outputTokens ?? 0,
    inputTokens: s.inputTokens ?? 0,
    text,
    thinkingMs: s.thinkingMs ?? 0,
    stopReason,
    success: s.status === "complete",
    error: s.error?.safeMessage,
  };
}

/**
 * v1 多取样中位数（旧 server /api/bench 的 samples>1 路径；T-005 移除调用）。
 * TPS 已改为逐样本计算后取中位数；usage 缺失时为 0（不字符估算）。
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
  const req = v1BuildRequest(input);
  const timeoutMs = input.timeoutMs ?? V1_DEFAULTS.timeoutMs;
  const collected: SampleResult[] = [];
  for (let i = 1; i <= samples; i++) {
    const s = await runSample(req, {
      protocol: input.protocol,
      timeoutMs,
    });
    collected.push(s);
    onProgress?.(i, fromSampleToV1(s, ""));
  }
  const run = aggregateRun(collected, {
    profile: {
      id: "v1-legacy",
      version: 0,
      promptSha256: sha256Hex(input.prompt || V1_DEFAULTS.prompt),
    },
    transport: "browser-direct",
    requestedSamples: (samples === 1 || samples === 3 || samples === 5
      ? samples
      : 1) as 1 | 3 | 5,
  });
  return {
    ttft: run.aggregate.ttftMs ?? 0,
    tps: run.aggregate.tps ?? 0,
    total: run.aggregate.totalMs,
    outputTokens: run.aggregate.outputTokens ?? 0,
    successCount: run.successCount,
  };
}
