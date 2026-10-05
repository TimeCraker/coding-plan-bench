// T-002 领域契约测试：schema version、SampleResult 不变量、错误码集合、
// Key 不属于任何可持久化 result 类型。
import { describe, expect, it } from "vitest";
import {
  MEASUREMENT_VERSION,
  SAMPLE_COUNTS,
  SCHEMA_VERSION,
  type BenchErrorCode,
  type BenchmarkRunResult,
  isSampleMetricValid,
  sampleInvariants,
} from "../../engine/types";
import { ERROR_CODES } from "../../engine/errors";
import { completeSample, failedSample } from "../fixtures/samples.fixture";

describe("schema 与 measurement 版本", () => {
  it("schemaVersion 固定为 2，measurementVersion 固定为 1", () => {
    expect(SCHEMA_VERSION).toBe(2);
    expect(MEASUREMENT_VERSION).toBe(1);
  });

  it("BenchmarkRunResult 类型携带 schemaVersion: 2 字面量", async () => {
    const { expectTypeOf } = await import("vitest");
    expectTypeOf<BenchmarkRunResult["schemaVersion"]>().toEqualTypeOf<2>();
    expectTypeOf<BenchmarkRunResult["measurementVersion"]>().toEqualTypeOf<1>();
  });
});

describe("样本数约束", () => {
  it("只允许 1/3/5", () => {
    expect(SAMPLE_COUNTS).toEqual([1, 3, 5]);
  });
});

describe("SampleResult 不变量（null / finite / non-negative）", () => {
  it("合法 complete 样本通过", () => {
    expect(sampleInvariants(completeSample())).toEqual([]);
  });

  it("负值 ttft 被拒绝", () => {
    const s = completeSample({ ttftMs: -10 });
    expect(sampleInvariants(s)).toContain("ttftMs");
  });

  it("NaN / Infinity 指标被拒绝", () => {
    expect(sampleInvariants(completeSample({ totalMs: Number.NaN }))).toContain(
      "totalMs",
    );
    expect(sampleInvariants(completeSample({ tps: Number.POSITIVE_INFINITY }))).toContain(
      "tps",
    );
  });

  it("complete 样本必须有 ttftMs（无正文不得 complete）", () => {
    const s = completeSample({ ttftMs: null });
    expect(sampleInvariants(s)).toContain("status-requires-ttft");
  });

  it("tps 只在 outputTokens 与 generationMs 同时可用时有意义", () => {
    const s = completeSample({ tps: 12.5, outputTokens: null });
    expect(sampleInvariants(s)).toContain("tps-requires-tokens");
  });

  it("failed 样本可以没有指标但 totalMs 必须 finite ≥ 0", () => {
    expect(sampleInvariants(failedSample())).toEqual([]);
    expect(
      sampleInvariants(failedSample({ totalMs: -1 })),
    ).toContain("totalMs");
  });

  it("isSampleMetricValid 只接受 finite ≥ 0", () => {
    expect(isSampleMetricValid(0)).toBe(true);
    expect(isSampleMetricValid(123.4)).toBe(true);
    expect(isSampleMetricValid(-0.1)).toBe(false);
    expect(isSampleMetricValid(Number.NaN)).toBe(false);
    expect(isSampleMetricValid(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isSampleMetricValid(null)).toBe(false);
  });
});

describe("错误码契约", () => {
  it("固定 12 个 code，与 Spec §4.5 一致", () => {
    expect([...ERROR_CODES].sort()).toEqual(
      [
        "validation",
        "consent",
        "cors/network",
        "auth",
        "rate-limit",
        "timeout",
        "protocol/parse",
        "empty-output",
        "usage-unavailable",
        "cancelled",
        "proxy-policy",
        "unknown",
      ].sort(),
    );
  });

  it("ERROR_CODES 是 BenchErrorCode 的穷举数组", () => {
    const codes: readonly BenchErrorCode[] = ERROR_CODES;
    expect(codes.length).toBe(new Set(codes).size);
  });
});

describe("Key 不属于可持久化结果", () => {
  it("BenchmarkRunResult JSON 序列化后不含 apiKey 字段名", () => {
    const run: BenchmarkRunResult = {
      schemaVersion: 2,
      measurementVersion: 1,
      profile: { id: "cpb-standard", version: 1, promptSha256: "a".repeat(64) },
      transport: "browser-direct",
      status: "complete",
      requestedSamples: 1,
      successCount: 1,
      aggregate: {
        ttftMs: 100,
        thinkingMs: null,
        generationMs: 900,
        totalMs: 1000,
        outputTokens: 100,
        inputTokens: 10,
        tps: 111.1,
        tokenSource: "provider",
      },
      samples: [completeSample()],
    };
    const json = JSON.stringify(run);
    expect(json).not.toContain("apiKey");
    expect(json).not.toContain("Authorization");
    expect(json).not.toContain("x-api-key");
  });
});
