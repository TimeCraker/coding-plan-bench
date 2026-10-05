// 单样本计量 reducer（FR-004）：统一时间线 + 状态 + 不变量。
//
// 时间线锚点：requestStart / firstReasoning / firstText / lastText / streamEnd。
// - TTFT   = firstText - requestStart（只认首个非空可见正文 delta）
// - thinking  = firstText - firstReasoning（仅 reasoning 出现且随后有正文）
// - generation = lastText - firstText（正文生成区间）
// - total  = streamEnd - requestStart
// - TPS    = outputTokens / (generation/1000)，usage 缺失或区间为 0 → null
//
// 纯函数：事件由外部消费循环注入时间戳，本模块不做任何 IO。

import type {
  BenchErrorCode,
  ProtocolEvent,
  SampleResult,
  TokenSource,
} from "./types";

export interface MeasurementState {
  requestStart: number;
  firstReasoning: number | null;
  firstText: number | null;
  lastText: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
  errorCode: BenchErrorCode | null;
  errorSafeMessage: string | null;
}

export function createMeasurementState(requestStart: number): MeasurementState {
  return {
    requestStart,
    firstReasoning: null,
    firstText: null,
    lastText: null,
    inputTokens: null,
    outputTokens: null,
    stopReason: null,
    errorCode: null,
    errorSafeMessage: null,
  };
}

/** 折叠一个带时间戳的协议事件（at 由消费循环的 now() 注入） */
export function applyEvent(
  state: MeasurementState,
  at: number,
  event: ProtocolEvent,
): void {
  switch (event.type) {
    case "reasoning":
      if (state.firstReasoning === null) state.firstReasoning = at;
      break;
    case "text":
      if (state.firstText === null) state.firstText = at;
      state.lastText = at;
      break;
    case "usage":
      state.inputTokens = event.inputTokens;
      state.outputTokens = event.outputTokens;
      break;
    case "finish":
      state.stopReason = event.stopReason;
      break;
    case "error":
      if (state.errorCode === null) {
        state.errorCode = event.code;
        state.errorSafeMessage = event.safeMessage;
      }
      break;
  }
}

function ms(delta: number): number {
  return Math.max(0, Math.round(delta));
}

/**
 * 终结单样本：按时间线与事件状态产出 SampleResult。
 * - 用户取消 → cancelled
 * - 协议 error 事件 → failed（携带稳定 code）
 * - 无正文（空 2xx 流）→ failed / empty-output，指标全部 null
 * - 否则 complete
 */
export function finalizeSample(
  state: MeasurementState,
  streamEnd: number,
  opts: { cancelled?: boolean } = {},
): SampleResult {
  const totalMs = ms(streamEnd - state.requestStart);

  if (opts.cancelled) {
    return {
      status: "cancelled",
      ttftMs: null,
      thinkingMs: null,
      generationMs: null,
      totalMs,
      outputTokens: null,
      inputTokens: null,
      tps: null,
      tokenSource: "unavailable",
      error: { code: "cancelled", safeMessage: "用户取消了本次测试" },
    };
  }

  if (state.errorCode !== null) {
    return {
      status: "failed",
      ttftMs: null,
      thinkingMs: null,
      generationMs: null,
      totalMs,
      outputTokens: null,
      inputTokens: null,
      tps: null,
      tokenSource: "unavailable",
      error: {
        code: state.errorCode,
        safeMessage: state.errorSafeMessage ?? "请求失败",
      },
    };
  }

  if (state.firstText === null || state.lastText === null) {
    // 空流 / 仅有 reasoning 的流：不允许以 0 或负指标进入聚合
    return {
      status: "failed",
      ttftMs: null,
      thinkingMs: null,
      generationMs: null,
      totalMs,
      outputTokens: null,
      inputTokens: null,
      tps: null,
      tokenSource: "unavailable",
      error: {
        code: "empty-output",
        safeMessage: "上游未返回任何正文（空流），本次样本记为失败",
      },
    };
  }

  const ttftMs = ms(state.firstText - state.requestStart);
  const thinkingMs =
    state.firstReasoning !== null
      ? ms(state.firstText - state.firstReasoning)
      : null;
  const generationMs = ms(state.lastText - state.firstText);

  const tokenSource: TokenSource =
    state.outputTokens !== null ? "provider" : "unavailable";
  const tps =
    state.outputTokens !== null && generationMs > 0
      ? Math.round((state.outputTokens / (generationMs / 1000)) * 10) / 10
      : null;

  return {
    status: "complete",
    ttftMs,
    thinkingMs,
    generationMs,
    totalMs,
    outputTokens: state.outputTokens,
    inputTokens: state.inputTokens,
    tps,
    tokenSource,
  };
}
