// T-008 可比性测试（AC-006 / FR-008）：comparability key 组成、分区隔离、
// 指标级过滤（TPS 需 provider usage）、demo 不获得"最优"。
import { describe, expect, it } from "vitest";
import type { LeaderboardEntryV2 } from "../../engine/types";
import {
  comparabilityKey,
  comparableGroups,
  rankableForMetric,
} from "../../site/src/lib/storage";
import { completeSample } from "../fixtures/samples.fixture";
import { aggregateRun } from "../../engine/aggregate";

function runWith(over: {
  profileId?: string;
  version?: number;
  measurement?: 1;
  transport?: "browser-direct" | "trusted-proxy" | "tauri-local";
  status?: "complete" | "partial" | "failed" | "cancelled";
  tps?: number | null;
}) {
  const samples = [
    completeSample(
      over.tps === undefined ? {} : { tps: over.tps, outputTokens: over.tps === null ? null : 100 },
    ),
  ];
  const agg = aggregateRun(samples, {
    profile: { id: over.profileId ?? "cpb-standard", version: over.version ?? 1, promptSha256: "x" },
    transport: over.transport ?? "browser-direct",
    requestedSamples: 1,
  });
  return { ...agg, status: over.status ?? agg.status, measurementVersion: over.measurement ?? 1 };
}

function entry(over: Parameters<typeof runWith>[0] & {
  protocol?: "anthropic" | "openai";
  legacy?: boolean;
  demo?: boolean;
  rankable?: boolean;
}): LeaderboardEntryV2 {
  const { protocol, legacy, demo, rankable, ...runOver } = over;
  return {
    schemaVersion: 2,
    id: `e-${Math.random().toString(36).slice(2)}`,
    label: "t",
    protocol: protocol ?? "anthropic",
    requestUrlDisplay: "https://a.example/v1/messages",
    model: "m",
    ranAt: new Date().toISOString(),
    run: runWith(runOver),
    ...(legacy ? { legacy: true as const } : {}),
    ...(demo ? { demo: true as const } : {}),
    rankable: rankable ?? (over.status ? over.status === "complete" : true),
  };
}

describe("comparability key", () => {
  it("profile 版本不同 → 不同 key", () => {
    const a = comparabilityKey(entry({}));
    const b = comparabilityKey(entry({ version: 2 }));
    expect(a).not.toBeNull();
    expect(a).not.toBe(b);
  });

  it("transport 不同 → 不同 key", () => {
    expect(comparabilityKey(entry({}))).not.toBe(
      comparabilityKey(entry({ transport: "trusted-proxy" })),
    );
  });

  it("协议不同 → 不同 key", () => {
    expect(comparabilityKey(entry({}))).not.toBe(
      comparabilityKey(entry({ protocol: "openai" })),
    );
  });

  it("同条件的 complete 数据共享 key", () => {
    expect(comparabilityKey(entry({}))).toBe(comparabilityKey(entry({})));
  });
});

describe("不可排名集合", () => {
  it("legacy / demo / partial / cancelled / failed → null", () => {
    expect(comparabilityKey(entry({ legacy: true, rankable: false }))).toBeNull();
    expect(comparabilityKey(entry({ demo: true, rankable: false }))).toBeNull();
    expect(comparabilityKey(entry({ status: "partial" }))).toBeNull();
    expect(comparabilityKey(entry({ status: "cancelled" }))).toBeNull();
    expect(comparabilityKey(entry({ status: "failed" }))).toBeNull();
  });
});

describe("指标级过滤（rankableForMetric）", () => {
  it("TPS 排名要求 provider usage（tps 非 null）", () => {
    const withUsage = entry({});
    const noUsage = entry({ tps: null });
    expect(rankableForMetric(withUsage, "tps")).toBe(true);
    expect(rankableForMetric(noUsage, "tps")).toBe(false);
    // TTFT / Total 不受 token source 影响
    expect(rankableForMetric(noUsage, "ttft")).toBe(true);
    expect(rankableForMetric(noUsage, "total")).toBe(true);
  });
});

describe("分组与「最优」", () => {
  it("comparableGroups 只收兼容 complete；demo 独立不进组", () => {
    const groups = comparableGroups([
      entry({}),
      entry({}),
      entry({ transport: "trusted-proxy" }),
      entry({ demo: true, rankable: false }),
      entry({ legacy: true, rankable: false }),
      entry({ status: "partial" }),
    ]);
    expect(groups.size).toBe(2);
    const main = [...groups.values()][0]!;
    expect(main.every((e) => !e.demo && !e.legacy)).toBe(true);
  });

  it("不同 profile 的 demo 即使数值更高也不进入真实组", () => {
    const real = entry({});
    const demo = entry({ demo: true, rankable: false, profileId: "zhipu-matrix-cli" });
    const groups = comparableGroups([real, demo]);
    expect(groups.size).toBe(1);
    expect([...groups.values()][0]).toHaveLength(1);
  });
});
