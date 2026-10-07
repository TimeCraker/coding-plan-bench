// 主题引导：Swiss Industrial Print 单一浅色主题（对齐 agent-hive，双主题已移除）。
// 固定 data-theme="light"；外链脚本（非内联）保证 CSP script-src 'self' 可用。
(function () {
  try {
    document.documentElement.setAttribute("data-theme", "light");
  } catch (e) {
    /* ignore */
  }
})();
