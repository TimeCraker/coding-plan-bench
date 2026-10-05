// 主题切换：亮/暗双主题，持久化到 localStorage；无保存偏好时跟随系统偏好。
// 首帧前由 public/theme-boot.js 设置 data-theme（防闪烁），这里负责读取与切换。

type Theme = "light" | "dark";
const KEY = "cpb:theme";

export function getTheme(): Theme {
  const saved = localStorage.getItem(KEY) as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  // 系统偏好（与 theme-boot.js 一致）
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(KEY, theme);
}

export function initTheme(): void {
  setTheme(getTheme());
}

export function toggleTheme(): Theme {
  const next = getTheme() === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}
