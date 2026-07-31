// 主题切换：亮色（默认）/ 暗色，持久化到 localStorage

type Theme = "light" | "dark";
const KEY = "cpb:theme";

export function getTheme(): Theme {
  const saved = localStorage.getItem(KEY) as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  return "light"; // 默认亮色
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
