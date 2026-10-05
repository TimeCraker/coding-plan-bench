// localStorage 榜单 v2（Spec §4.3 / AC-006）：
// - key `cpb:leaderboard:v2`；旧 `cpb:leaderboard` 只读迁移一次（幂等），原值备份到 `cpb:leaderboard:v1-backup`
// - v1 记录 → legacy:true / rankable:false / 不推断 transport/profile/tokenSource
// - 损坏 JSON 不覆盖原值，隔离为 recovery 状态，由 UI 提供「重置本地数据」
// - 绝不存 Key；Request URL 保存前规范化为 origin + pathname
// - 多标签页：storage event 快照按 id/ranAt 去重合并

import type {
  BenchmarkRunResult,
  LeaderboardEntryV2,
  Protocol,
} from "../../../engine/types";
import demoResults from "../data/demo-results.v2.json";

export const V2_KEY = "cpb:leaderboard:v2";
export const V1_KEY = "cpb:leaderboard";
export const V1_BACKUP_KEY = "cpb:leaderboard:v1-backup";
/** v1 的 seed 标记：迁移后不再使用（保留原值，不主动删除） */
export const V1_SEEDED_KEY = "cpb:seeded";

/** 存储接口（测试注入内存实现） */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike {
  return {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
    removeItem: (k) => localStorage.removeItem(k),
  };
}

export interface LoadResult {
  entries: LeaderboardEntryV2[];
  /** 损坏隔离：v2 原值未被覆盖，用户可选择重置 */
  recovery: "ok" | "corrupt-v2";
}

/** v1 条目（宽容解析：只有数值字段被读取） */
interface V1Entry {
  id?: string;
  label?: string;
  endpoint?: string;
  model?: string;
  protocol?: string;
  ttft?: number;
  tps?: number;
  total?: number;
  outputTokens?: number;
  samples?: number;
  ranAt?: string;
}

function normalizeUrlDisplay(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw;
  }
}

function migrateV1Entry(e: V1Entry, i: number): LeaderboardEntryV2 | null {
  if (typeof e.ttft !== "number" || typeof e.total !== "number") return null;
  return {
    schemaVersion: 2,
    id: typeof e.id === "string" ? e.id : `legacy-${i}`,
    label: typeof e.label === "string" ? e.label : (e.model ?? "旧记录"),
    protocol: e.protocol === "openai" ? "openai" : "anthropic",
    requestUrlDisplay:
      typeof e.endpoint === "string" ? normalizeUrlDisplay(e.endpoint) : "",
    model: typeof e.model === "string" ? e.model : "",
    ranAt: typeof e.ranAt === "string" ? e.ranAt : new Date(0).toISOString(),
    // 不推断：无 run、无 transport/profile/tokenSource 伪装
    legacy: true,
    rankable: false,
    legacyMetrics: {
      ttft: e.ttft,
      tps: typeof e.tps === "number" ? e.tps : 0,
      total: e.total,
      outputTokens: typeof e.outputTokens === "number" ? e.outputTokens : 0,
      samples: typeof e.samples === "number" ? e.samples : 1,
    },
  };
}

function demoEntries(): LeaderboardEntryV2[] {
  return demoResults.entries.map((e) => ({ ...e } as LeaderboardEntryV2));
}

let storageImpl: StorageLike | null = null;
export function setStorage(s: StorageLike): void {
  storageImpl = s;
}
function store(): StorageLike {
  return storageImpl ?? browserStorage();
}

export function loadLeaderboard(): LoadResult {
  const s = store();
  const rawV2 = s.getItem(V2_KEY);

  if (rawV2 !== null) {
    try {
      const parsed = JSON.parse(rawV2) as LeaderboardEntryV2[];
      if (!Array.isArray(parsed)) throw new Error("not array");
      return { entries: parsed, recovery: "ok" };
    } catch {
      // 损坏：不覆盖原值，隔离为 recovery（UI 提供「重置本地数据」）
      return { entries: [], recovery: "corrupt-v2" };
    }
  }

  // v2 不存在：检查 v1（只读迁移一次，幂等）
  const rawV1 = s.getItem(V1_KEY);
  if (rawV1 !== null) {
    const migrated = migrateV1Once(s, rawV1);
    return { entries: migrated, recovery: "ok" };
  }

  // 全新用户：注入示例数据（demo 分区，永不参与排名）
  const seeded = demoEntries();
  s.setItem(V2_KEY, JSON.stringify(seeded));
  return { entries: seeded, recovery: "ok" };
}

function migrateV1Once(s: StorageLike, rawV1: string): LeaderboardEntryV2[] {
  // 备份原值（幂等：已有备份不覆盖）
  if (s.getItem(V1_BACKUP_KEY) === null) {
    s.setItem(V1_BACKUP_KEY, rawV1);
  }
  let legacy: LeaderboardEntryV2[] = [];
  try {
    const arr = JSON.parse(rawV1) as V1Entry[];
    if (Array.isArray(arr)) {
      legacy = arr
        .map((e, i) => migrateV1Entry(e, i))
        .filter((e): e is LeaderboardEntryV2 => e !== null);
    }
  } catch {
    legacy = [];
  }
  const merged = [...demoEntries(), ...legacy];
  s.setItem(V2_KEY, JSON.stringify(merged));
  // 不删除 v1 key（用户明确重置前保留）
  return merged;
}

export function saveLeaderboard(entries: LeaderboardEntryV2[]): void {
  try {
    store().setItem(V2_KEY, JSON.stringify(entries));
  } catch {
    // 容量满或禁用：静默（不抛出到 UI）
  }
}

export interface NewRunInput {
  label: string;
  protocol: Protocol;
  requestUrl: string;
  model: string;
  run: BenchmarkRunResult;
}

/** 从一次运行构造榜单条目（URL 规范化；只有 complete 入默认排名视图） */
export function makeEntryFromRun(input: NewRunInput): LeaderboardEntryV2 {
  const { run } = input;
  return {
    schemaVersion: 2,
    id: genId(),
    label: input.label || input.model,
    protocol: input.protocol,
    requestUrlDisplay: normalizeUrlDisplay(input.requestUrl),
    model: input.model,
    ranAt: new Date().toISOString(),
    run,
    rankable: run.status === "complete",
  };
}

export function addEntry(entry: LeaderboardEntryV2): LeaderboardEntryV2[] {
  const { entries } = loadLeaderboard();
  const list = entries.filter((e) => e.id !== entry.id);
  list.push(entry);
  saveLeaderboard(list);
  return list;
}

export function removeEntry(id: string): {
  entries: LeaderboardEntryV2[];
  removed: LeaderboardEntryV2 | null;
} {
  const { entries } = loadLeaderboard();
  const removed = entries.find((e) => e.id === id) ?? null;
  const list = entries.filter((e) => e.id !== id);
  saveLeaderboard(list);
  return { entries: list, removed };
}

export function restoreEntry(entry: LeaderboardEntryV2): LeaderboardEntryV2[] {
  return addEntry(entry);
}

export function clearLeaderboard(): void {
  saveLeaderboard([]);
}

/** 用户明确的「重置本地数据」：清 v2 与隔离的损坏值（保留 v1 备份直到用户也确认删除） */
export function resetLocalData(): void {
  const s = store();
  s.removeItem(V2_KEY);
  s.removeItem(V1_KEY);
}

export function genId(): string {
  return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 多标签页：外部快照与当前列表按 id 去重合并（后写覆盖同 id） */
export function mergeExternalSnapshot(
  current: readonly LeaderboardEntryV2[],
  snapshot: readonly LeaderboardEntryV2[],
): LeaderboardEntryV2[] {
  const byId = new Map<string, LeaderboardEntryV2>();
  for (const e of current) byId.set(e.id, e);
  for (const e of snapshot) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => (a.ranAt < b.ranAt ? 1 : -1));
}

// ───────────────────────── comparability（FR-008） ─────────────────────────

export type RankableMetric = "ttft" | "tps" | "total";

/**
 * 可比性 key：相同 profile 版本 + 测量版本 + transport + 协议 的 complete 真实数据。
 * legacy / demo / 非 complete / 缺 run → null（不参与任何排名）。
 */
export function comparabilityKey(e: LeaderboardEntryV2): string | null {
  if (e.legacy || e.demo || !e.rankable || !e.run) return null;
  if (e.run.status !== "complete") return null;
  return [
    e.run.profile.id,
    e.run.profile.version,
    `m${e.run.measurementVersion}`,
    e.run.transport,
    e.protocol,
  ].join("/");
}

/** 指标级可比：TPS 排名额外要求 provider usage（tps 非 null） */
export function rankableForMetric(
  e: LeaderboardEntryV2,
  metric: RankableMetric,
): boolean {
  const key = comparabilityKey(e);
  if (key === null || !e.run) return false;
  if (metric === "tps") return e.run.aggregate.tps !== null;
  return true;
}

export function comparableGroups(
  entries: readonly LeaderboardEntryV2[],
): Map<string, LeaderboardEntryV2[]> {
  const groups = new Map<string, LeaderboardEntryV2[]>();
  for (const e of entries) {
    const key = comparabilityKey(e);
    if (key === null) continue;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  return groups;
}
