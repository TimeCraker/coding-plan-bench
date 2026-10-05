// T-008 存储迁移测试（AC-006）：v1 backup + 幂等迁移、损坏隔离、demo 种子、
// URL 规范化、Key 不入库、多标签页合并、重置。
import { beforeEach, describe, expect, it } from "vitest";
import type { LeaderboardEntryV2 } from "../../engine/types";
import {
  V1_BACKUP_KEY,
  V1_KEY,
  V2_KEY,
  addEntry,
  clearLeaderboard,
  comparabilityKey,
  loadLeaderboard,
  makeEntryFromRun,
  mergeExternalSnapshot,
  removeEntry,
  resetLocalData,
  restoreEntry,
  setStorage,
  type StorageLike,
} from "../../site/src/lib/storage";
import { completeSample } from "../fixtures/samples.fixture";
import { CPB_STANDARD_PROFILE } from "../../engine/profiles";
import { aggregateRun } from "../../engine/aggregate";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function v1Data(): string {
  return JSON.stringify([
    {
      id: "old-1",
      label: "智谱 GLM-5.2",
      endpoint: "https://open.bigmodel.cn/api/anthropic?foo=1",
      model: "glm-5.2",
      protocol: "anthropic",
      ttft: 100,
      tps: 50,
      total: 2000,
      outputTokens: 90,
      samples: 3,
      ranAt: "2026-07-01T00:00:00.000Z",
    },
  ]);
}

function completeRun() {
  return aggregateRun([completeSample()], {
    profile: {
      id: CPB_STANDARD_PROFILE.id,
      version: CPB_STANDARD_PROFILE.version,
      promptSha256: CPB_STANDARD_PROFILE.promptSha256,
    },
    transport: "browser-direct",
    requestedSamples: 1,
  });
}

beforeEach(() => {
  setStorage(memoryStorage());
});

describe("全新用户：demo 种子", () => {
  it("注入示例分区（demo:true / rankable:false），二次加载不重复", () => {
    const first = loadLeaderboard();
    expect(first.recovery).toBe("ok");
    expect(first.entries.length).toBeGreaterThan(0);
    expect(first.entries.every((e) => e.demo === true)).toBe(true);
    const second = loadLeaderboard();
    expect(second.entries.length).toBe(first.entries.length);
  });
});

describe("v1 → v2 迁移（幂等 + 备份）", () => {
  it("备份原值到 v1-backup；v1 记录变 legacy 且不推断 provenance", () => {
    setStorage(memoryStorage({ [V1_KEY]: v1Data() }));
    const { entries } = loadLeaderboard();
    const legacy = entries.find((e) => e.legacy === true);
    expect(legacy).toBeDefined();
    expect(legacy!.rankable).toBe(false);
    expect(legacy!.run).toBeUndefined();
    expect(legacy!.legacyMetrics).toEqual({
      ttft: 100,
      tps: 50,
      total: 2000,
      outputTokens: 90,
      samples: 3,
    });
    // URL 规范化：去 query
    expect(legacy!.requestUrlDisplay).toBe(
      "https://open.bigmodel.cn/api/anthropic",
    );

    const s = loadLeaderboard(); // 二次（幂等）
    expect(s.entries.filter((e) => e.legacy).length).toBe(1);
  });

  it("迁移后 v1 key 保留（不主动删除）", () => {
    const st = memoryStorage({ [V1_KEY]: v1Data() });
    setStorage(st);
    loadLeaderboard();
    expect(st.getItem(V1_KEY)).toBe(v1Data());
    expect(st.getItem(V1_BACKUP_KEY)).toBe(v1Data());
  });

  it("迁移不丢 demo（示例与遗留共存于 v2）", () => {
    setStorage(memoryStorage({ [V1_KEY]: v1Data() }));
    const { entries } = loadLeaderboard();
    expect(entries.some((e) => e.demo)).toBe(true);
    expect(entries.some((e) => e.legacy)).toBe(true);
  });
});

describe("损坏 v2：隔离不覆盖", () => {
  it("返回 recovery=corrupt-v2 且原值保留", () => {
    const st = memoryStorage({ [V2_KEY]: "{corrupted" });
    setStorage(st);
    const r = loadLeaderboard();
    expect(r.recovery).toBe("corrupt-v2");
    expect(r.entries).toEqual([]);
    expect(st.getItem(V2_KEY)).toBe("{corrupted");
  });
});

describe("条目写入", () => {
  it("makeEntryFromRun：complete 才 rankable；URL 规范化去 query；无 Key 字段", () => {
    const entry = makeEntryFromRun({
      label: "GLM-5.3",
      protocol: "anthropic",
      requestUrl: "https://open.bigmodel.cn/api/anthropic/v1/messages?x=1",
      model: "glm-5.3",
      run: completeRun(),
    });
    expect(entry.rankable).toBe(true);
    expect(entry.requestUrlDisplay).toBe(
      "https://open.bigmodel.cn/api/anthropic/v1/messages",
    );
    expect(JSON.stringify(entry)).not.toContain("apiKey");
    expect(JSON.stringify(entry)).not.toContain("sk-");
  });

  it("partial 运行 rankable=false", () => {
    const run = aggregateRun(
      [completeSample(), completeSample(), { ...completeSample(), status: "failed" as const, ttftMs: null, tps: null, outputTokens: null, tokenSource: "unavailable" as const }],
      {
        profile: { id: "cpb-standard", version: 1, promptSha256: "x" },
        transport: "browser-direct",
        requestedSamples: 3,
      },
    );
    const entry = makeEntryFromRun({
      label: "x", protocol: "anthropic", requestUrl: "https://a.example/v1/messages",
      model: "m", run,
    });
    expect(run.status).toBe("partial");
    expect(entry.rankable).toBe(false);
    expect(comparabilityKey(entry)).toBeNull();
  });

  it("removeEntry 返回被删条目；restoreEntry 恢复", () => {
    const entry = makeEntryFromRun({
      label: "x", protocol: "anthropic", requestUrl: "https://a.example/v1/messages",
      model: "m", run: completeRun(),
    });
    addEntry(entry);
    const { entries, removed } = removeEntry(entry.id);
    expect(removed).toEqual(entry);
    expect(entries.find((e) => e.id === entry.id)).toBeUndefined();
    const restored = restoreEntry(entry);
    expect(restored.find((e) => e.id === entry.id)).toEqual(entry);
  });

  it("clearLeaderboard 清空", () => {
    const entry = makeEntryFromRun({
      label: "x", protocol: "anthropic", requestUrl: "https://a.example/v1/messages",
      model: "m", run: completeRun(),
    });
    addEntry(entry);
    clearLeaderboard();
    expect(loadLeaderboard().entries).toEqual([]);
  });
});

describe("多标签页合并（storage event 快照）", () => {
  it("按 id 去重；外部新条目并入且排序稳定", () => {
    const a = makeEntryFromRun({
      label: "a", protocol: "anthropic", requestUrl: "https://a.example/v1/messages",
      model: "m", run: completeRun(),
    });
    const b: LeaderboardEntryV2 = {
      ...a,
      id: "ext-1",
      ranAt: new Date(Date.now() + 1000).toISOString(),
    };
    const merged = mergeExternalSnapshot([a], [b, a]);
    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.id === "ext-1")).toEqual(b);
    // ranAt 新的在前
    expect(merged[0]!.id).toBe("ext-1");
  });
});

describe("重置本地数据", () => {
  it("resetLocalData 清 v2/v1（保留 v1-backup 供恢复查看）", () => {
    const st = memoryStorage({
      [V1_KEY]: v1Data(),
      [V1_BACKUP_KEY]: v1Data(),
      [V2_KEY]: "[]",
    });
    setStorage(st);
    resetLocalData();
    expect(st.getItem(V2_KEY)).toBeNull();
    expect(st.getItem(V1_KEY)).toBeNull();
    expect(st.getItem(V1_BACKUP_KEY)).toBe(v1Data());
  });
});
