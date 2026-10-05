// 样本 fixture：构造合法/非法 SampleResult 的工厂，供 types/measurement/aggregate 测试复用。
import type { SampleResult } from "../../engine/types";

type SampleOverrides = Partial<Omit<SampleResult, "status">>;

export function completeSample(over: SampleOverrides = {}): SampleResult {
  return {
    status: "complete",
    ttftMs: 120,
    thinkingMs: null,
    generationMs: 880,
    totalMs: 1000,
    outputTokens: 96,
    inputTokens: 12,
    tps: 109.1,
    tokenSource: "provider",
    ...over,
  };
}

export function completeWithThinking(over: SampleOverrides = {}): SampleResult {
  return completeSample({ thinkingMs: 300, ...over });
}

export function failedSample(over: SampleOverrides = {}): SampleResult {
  return {
    status: "failed",
    ttftMs: null,
    thinkingMs: null,
    generationMs: null,
    totalMs: 500,
    outputTokens: null,
    inputTokens: null,
    tps: null,
    tokenSource: "unavailable",
    error: { code: "empty-output", safeMessage: "上游未返回任何正文" },
    ...over,
  };
}

export function cancelledSample(over: SampleOverrides = {}): SampleResult {
  return {
    status: "cancelled",
    ttftMs: null,
    thinkingMs: null,
    generationMs: null,
    totalMs: 250,
    outputTokens: null,
    inputTokens: null,
    tps: null,
    tokenSource: "unavailable",
    error: { code: "cancelled", safeMessage: "用户取消" },
    ...over,
  };
}
