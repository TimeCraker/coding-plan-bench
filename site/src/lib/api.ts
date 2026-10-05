// 测速入口（S01）：显式 transport 编排（site/src/lib/transports）+ v1 兼容层。
//
// 新代码请使用 `runBench`（transports/index）或 `useBenchmarkRun` hook。
// legacyRunBench 仅供未迁移的旧 UI 过渡：单样本 browser-direct；
// samples>1 不再自动切代理（AUD-001 根治）——由调用方显式选择 transport。

import type { BenchmarkRunResult } from "../../../engine/types";
import { benchError } from "../../../engine/errors";
import { validateRequestUrl } from "../../../engine/request";
import { CPB_STANDARD_PROFILE } from "../../../engine/profiles";
import { runBench, type RunBenchOptions } from "./transports";

export type { RunBenchOptions } from "./transports";
export { createConsentToken } from "./transports";

/** v1 结果形状（旧 ResultCard 过渡使用；T-007 移除） */
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

/** 运行显式 transport 的测速（URL 结构校验前置，稳定 validation 错误） */
export async function runExplicitBench(
  opts: RunBenchOptions,
): Promise<BenchmarkRunResult> {
  const check = validateRequestUrl(opts.requestUrl);
  if (!check.ok) {
    throw benchError("validation", `Request URL 无效：${check.reason}`);
  }
  return runBench(opts);
}

/** @deprecated v1 兼容：单样本 browser-direct。多样本需调用方显式选 transport。 */
export async function legacyRunBench(p: {
  requestUrl: string;
  apiKey: string;
  model: string;
  protocol: "anthropic" | "openai";
  samples?: number;
  onStage?: (stage: "direct") => void;
}): Promise<BenchApiResponse> {
  p.onStage?.("direct");
  const run = await runExplicitBench({
    transport: "browser-direct",
    requestUrl: p.requestUrl,
    apiKey: p.apiKey,
    model: p.model,
    protocol: p.protocol,
    samples: 1,
    profile: CPB_STANDARD_PROFILE,
  });
  return {
    ttft: run.aggregate.ttftMs ?? 0,
    total: run.aggregate.totalMs,
    outputTokens: run.aggregate.outputTokens ?? 0,
    inputTokens: run.aggregate.inputTokens ?? 0,
    thinkingMs: run.aggregate.thinkingMs ?? 0,
    success: run.status === "complete",
    error: run.samples.find((s) => s.error)?.error?.safeMessage,
    samples: 1,
  };
}
