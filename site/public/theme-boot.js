// 主题引导：在首帧渲染前设置 data-theme，避免暗色用户看到亮色闪烁（FOUC）。
// 无保存偏好时跟随系统 prefers-color-scheme。外链脚本（非内联）保证 CSP script-src 'self' 可用。
(function () {
  try {
    var t = localStorage.getItem("cpb:theme");
    if (t !== "light" && t !== "dark") {
      t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {
    /* localStorage 不可用：保持默认亮色 */
  }
})();
