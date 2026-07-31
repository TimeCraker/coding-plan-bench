// localStorage 榜单：只存指标，绝不存 key
// 首次访问（localStorage 空）时，用内置示例数据预填，让新用户看到对比样例

import type { LeaderboardEntry } from "../../../engine/types";

const KEY = "cpb:leaderboard";
const SEEDED = "cpb:seeded"; // 是否已注入过示例数据

/** 内置示例数据（来自 v1 三家 GLM-5.2 实测中位数） */
const SEED_ENTRIES: LeaderboardEntry[] = [
  {
    id: "seed-zhipu",
    label: "智谱 GLM Coding Plan",
    endpoint: "https://open.bigmodel.cn/api/anthropic",
    model: "glm-5.2",
    protocol: "anthropic",
    ttft: 1416,
    tps: 83,
    total: 3924,
    outputTokens: 412,
    samples: 3,
    ranAt: "2026-07-31T07:31:06.000Z",
  },
  {
    id: "seed-baidu",
    label: "百度千帆 Qianfan Token Plan",
    endpoint: "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
    model: "glm-5.2",
    protocol: "anthropic",
    ttft: 834,
    tps: 73,
    total: 7762,
    outputTokens: 398,
    samples: 3,
    ranAt: "2026-07-31T07:31:06.000Z",
  },
  {
    id: "seed-volcengine",
    label: "火山方舟 Ark Coding Plan",
    endpoint: "https://ark.cn-beijing.volces.com/api/coding",
    model: "glm-5.2[1m]",
    protocol: "anthropic",
    ttft: 2395,
    tps: 68,
    total: 10413,
    outputTokens: 405,
    samples: 3,
    ranAt: "2026-07-31T07:31:06.000Z",
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
