// 主题：Swiss Industrial Print 单一浅色主题（对齐 agent-hive 视觉世界）。
// 双主题已随 UI 重构移除；保留导出面以兼容渐进迁移，全部固定 light。
export type Theme = "light";

export function getTheme(): Theme {
  return "light";
}

export function initTheme(): void {
  document.documentElement.setAttribute("data-theme", "light");
}

/** 兼容残留：无切换行为，恒返回 light */
export function toggleTheme(): Theme {
  initTheme();
  return "light";
}
