// localStorage 榜单：只存指标，绝不存 key
// 首次访问（localStorage 空）时，用内置示例数据预填，让新用户看到对比样例

import type { LeaderboardEntry } from "../../../engine/types";

const KEY = "cpb:leaderboard";
const SEEDED = "cpb:seeded"; // 是否已注入过示例数据

/** 内置示例数据（来自 2026-10-05 glm-5.3 模型矩阵实测中位数，results/ 有完整报告） */
const SEED_ENTRIES: LeaderboardEntry[] = [
  {
    id: "seed-zhipu-glm53",
    label: "智谱 GLM-5.3",
    endpoint: "https://open.bigmodel.cn/api/anthropic",
    model: "glm-5.3",
    protocol: "anthropic",
    ttft: 1389,
    tps: 89,
    total: 19943,
    outputTokens: 1584,
    samples: 8,
    ranAt: "2026-10-05T08:07:39.753Z",
  },
  {
    id: "seed-zhipu-glm53-flash",
    label: "智谱 GLM-5.3-Flash",
    endpoint: "https://open.bigmodel.cn/api/anthropic",
    model: "glm-5.3-flash",
    protocol: "anthropic",
    ttft: 892,
    tps: 64,
    total: 34700,
    outputTokens: 2116,
    samples: 8,
    ranAt: "2026-10-05T08:07:39.753Z",
  },
];

/** 加载榜单：首次访问注入示例数据 */
export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const seeded = localStorage.getItem(SEEDED);
    const raw = localStorage.getItem(KEY);
    if (!seeded && !raw) {
      // 首次访问：注入示例数据
      saveLeaderboard(SEED_ENTRIES);
      localStorage.setItem(SEEDED, "1");
      return SEED_ENTRIES;
    }
    if (!raw) return [];
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    localStorage.setItem(SEEDED, "1");
  } catch {
    // 容量满或禁用，静默
  }
}

export function addEntry(entry: LeaderboardEntry): LeaderboardEntry[] {
  const list = loadLeaderboard().filter((e) => e.id !== entry.id);
  list.push(entry);
  saveLeaderboard(list);
  return list;
}

export function removeEntry(id: string): LeaderboardEntry[] {
  const list = loadLeaderboard().filter((e) => e.id !== id);
  saveLeaderboard(list);
  return list;
}

export function clearLeaderboard(): void {
  saveLeaderboard([]);
}

export function genId(): string {
  return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 判断是否示例数据 */
export function isSeed(id: string): boolean {
  return id.startsWith("seed-");
}
