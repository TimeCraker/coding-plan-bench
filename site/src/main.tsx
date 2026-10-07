import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initTheme } from "./lib/theme";
import "./styles/globals.css";

// Swiss 单浅色主题：渲染前挂 data-theme（无切换、无防闪烁引导需求）
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
