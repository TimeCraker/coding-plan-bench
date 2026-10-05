// T-004 聚合测试（AC-002）：1/3/5 与 complete/partial/failed/cancelled 矩阵；
// TPS 逐样本计算后取中位数（禁止独立中位数拼接，AUD-005）。
import { describe, expect, it } from "vitest";
import { aggregateRun, median } from "../../engine/aggregate";
import type { SampleResult } from "../../engine/types";
import {
  cancelledSample,
  completeSample,
  failedSample,
} from "../fixtures/samples.fixture";

const META = {
  profile: { id: "cpb-standard", version: 1, promptSha256: "a".repeat(64) },
  transport: "browser-direct" as const,
};

describe("median", () => {
  it("奇数取中间；偶数取平均四舍五入", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3); // (2+3)/2 = 2.5 → round 3
    expect(median([5])).toBe(5);
  });
});

describe("样本数矩阵", () => {
  it("1 样本成功 → complete", () => {
    const run = aggregateRun([completeSample()], {
      ...META,
      requestedSamples: 1,
    });
    expect(run.status).toBe("complete");
    expect(run.successCount).toBe(1);
    expect(run.schemaVersion).toBe(2);
    expect(run.measurementVersion).toBe(1);
  });

  it("3 样本全成功 → complete；1 失败 → partial；全失败 → failed", () => {
    const ok = () => completeSample();
    expect(
      aggregateRun([ok(), ok(), ok()], { ...META, requestedSamples: 3 }).status,
    ).toBe("complete");
    const partial = aggregateRun([ok(), ok(), failedSample()], {
      ...META,
      requestedSamples: 3,
    });
    expect(partial.status).toBe("partial");
    expect(partial.successCount).toBe(2);
    expect(
      aggregateRun([failedSample(), failedSample(), failedSample()], {
        ...META,
        requestedSamples: 3,
      }).status,
    ).toBe("failed");
  });

  it("5 样本 3 成功 → partial，聚合只含成功样本指标", () => {
    const a = completeSample({ ttftMs: 100, totalMs: 1000 });
    const b = completeSample({ ttftMs: 200, totalMs: 1200 });
    const c = completeSample({ ttftMs: 300, totalMs: 1400 });
    const run = aggregateRun(
      [a, b, c, failedSample({ totalMs: 50 }), cancelledSample()],
      { ...META, requestedSamples: 5 },
    );
    expect(run.status).toBe("cancelled"); // 取消优先：用户主动停止
    expect(run.successCount).toBe(3);
    expect(run.aggregate.ttftMs).toBe(200);
    expect(run.aggregate.totalMs).toBe(1200);
  });

  it("任一 cancelled → 状态 cancelled（含已有成功样本时）", () => {
    const run = aggregateRun([completeSample(), cancelledSample()], {
      ...META,
      requestedSamples: 3,
    });
    expect(run.status).toBe("cancelled");
  });

  it("partial 不参与排名的信号：rankable 由消费方判断，successCount < requestedSamples 可机械判定", () => {
    const run = aggregateRun([completeSample(), failedSample()], {
      ...META,
      requestedSamples: 3,
    });
    expect(run.status).toBe("partial");
    expect(run.successCount).toBeLessThan(run.requestedSamples);
  });
});

describe("逐指标中位数与 TPS 语义", () => {
  it("TPS = 逐样本 TPS 的中位数（与独立中位数拼接结果不同，AUD-005）", () => {
    // 样本 A：ttft=100, total=2000, gen=1900, out=100 → tps≈52.6
    // 样本 B：ttft=500, total=2100, gen=1600, out=200 → tps=125
    const a = completeSample({
      ttftMs: 100,
      generationMs: 1900,
      totalMs: 2000,
      outputTokens: 100,
      tps: 52.6,
    });
    const b = completeSample({
      ttftMs: 500,
      generationMs: 1600,
      totalMs: 2100,
      outputTokens: 200,
      tps: 125,
    });
    const run = aggregateRun([a, b], { ...META, requestedSamples: 3 });
    // v1 拼法：med(out)=150 / (med(total)-med(ttft)=1750ms) ≈ 85.7 —— 必须不等于本值
    expect(run.aggregate.tps).toBe(89); // (52.6 + 125) / 2 = 88.8 → round 89
    expect(run.aggregate.tps).not.toBe(86);
    expect(run.status).toBe("partial");
  });

  it("成功样本 token source 混合 → aggregate tokenSource=unavailable", () => {
    const a = completeSample({ tokenSource: "provider" });
    const b = completeSample({
      tokenSource: "unavailable",
      outputTokens: null,
      tps: null,
    });
    const run = aggregateRun([a, b], { ...META, requestedSamples: 3 });
    expect(run.aggregate.tokenSource).toBe("unavailable");
    expect(run.aggregate.tps).not.toBeNull(); // 仅 provider 样本参与 tps 中位数
  });

  it("0 成功样本：aggregate 指标 null（不伪装）", () => {
    const run = aggregateRun([failedSample(), failedSample(), failedSample()], {
      ...META,
      requestedSamples: 3,
    });
    expect(run.aggregate.ttftMs).toBeNull();
    expect(run.aggregate.tps).toBeNull();
    expect(run.aggregate.tokenSource).toBe("unavailable");
    // totalMs 始终存在（failed 样本也有墙钟）
    expect(run.aggregate.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("samples 数组原样保留全部样本明细", () => {
    const samples: SampleResult[] = [
      completeSample(),
      failedSample(),
      cancelledSample(),
    ];
    const run = aggregateRun(samples, { ...META, requestedSamples: 3 });
    expect(run.samples).toHaveLength(3);
    expect(run.samples[1]?.status).toBe("failed");
  });
});
