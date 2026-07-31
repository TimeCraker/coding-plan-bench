// localStorage 榜单：只存指标，绝不存 key

import type { LeaderboardEntry } from "../../../engine/types";

const KEY = "cpb:leaderboard";

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // 容量满或禁用，静默
  }
}

export function addEntry(entry: LeaderboardEntry): LeaderboardEntry[] {
  const list = loadLeaderboard();
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
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
