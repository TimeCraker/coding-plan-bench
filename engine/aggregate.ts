// 多样本聚合（FR-005）：逐指标独立取中位数 + complete/partial/failed/cancelled。
//
// 与 v1 的关键差异：
// - TPS 逐样本计算后再对 TPS 取中位数（禁止用 TTFT/Total/outputTokens 三个独立中位数拼算）
// - 只有 complete 样本参与聚合；partial/failed/cancelled 不伪装成可排名数据
// - status 语义：any cancelled → cancelled；全成功 → complete；0 成功 → failed；否则 partial

import type {
  AggregateMetrics,
  BenchmarkRunResult,
  SampleResult,
  TransportKind,
} from "./types";
import { MEASUREMENT_VERSION, SCHEMA_VERSION } from "./types";

/** 中位数：偶数个取中间两数平均后四舍五入 */
export function median(nums: number[]): number {
  if (nums.length === 0) throw new Error("median of empty array");
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m];
  return Math.round((s[m - 1] + s[m]) / 2);
}

function medianOrNull(nums: number[]): number | null {
  return nums.length > 0 ? median(nums) : null;
}

/**
 * 聚合一次运行的全部样本，产出 BenchmarkRunResult（schema v2）。
 * profile 只携带 provenance 三元组（id/version/promptSha256）。
 */
export function aggregateRun(
  samples: readonly SampleResult[],
  meta: {
    profile: { id: string; version: number; promptSha256: string };
    transport: TransportKind;
    requestedSamples: 1 | 3 | 5;
  },
): BenchmarkRunResult {
  const ok = samples.filter((s) => s.status === "complete");
  const successCount = ok.length;

  let status: BenchmarkRunResult["status"];
  if (samples.some((s) => s.status === "cancelled")) {
    status = "cancelled";
  } else if (successCount === meta.requestedSamples) {
    status = "complete";
  } else if (successCount === 0) {
    status = "failed";
  } else {
    status = "partial";
  }

  const aggregate: AggregateMetrics = {
    ttftMs: medianOrNull(ok.map((s) => s.ttftMs).filter((v): v is number => v !== null)),
    thinkingMs: medianOrNull(
      ok.map((s) => s.thinkingMs).filter((v): v is number => v !== null),
    ),
    generationMs: medianOrNull(
      ok.map((s) => s.generationMs).filter((v): v is number => v !== null),
    ),
    // totalMs：成功样本中位数；0 成功时退回全部样本墙钟（诊断价值，不可排名）
    totalMs: median(
      ok.length > 0 ? ok.map((s) => s.totalMs) : samples.map((s) => s.totalMs),
    ),
    outputTokens: medianOrNull(
      ok.map((s) => s.outputTokens).filter((v): v is number => v !== null),
    ),
    inputTokens: medianOrNull(
      ok.map((s) => s.inputTokens).filter((v): v is number => v !== null),
    ),
    // TPS 已是逐样本值，这里直接取中位数
    tps: medianOrNull(ok.map((s) => s.tps).filter((v): v is number => v !== null)),
    tokenSource: ok.every((s) => s.tokenSource === "provider") && ok.length > 0
      ? "provider"
      : "unavailable",
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    measurementVersion: MEASUREMENT_VERSION,
    profile: meta.profile,
    transport: meta.transport,
    status,
    requestedSamples: meta.requestedSamples,
    successCount,
    aggregate,
    samples: [...samples],
  };
}
