import { motion } from "framer-motion";
import { Activity, Globe, Sun, Moon, Github, Zap } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

export type View = "bench" | "global";

const NAV: { id: View; label: string; short: string; desc: string; icon: React.ReactNode }[] = [
  { id: "bench", label: "测速台", short: "测速", desc: "本机实测 TTFT/TPS/Total", icon: <Activity className="w-[18px] h-[18px]" /> },
  { id: "global", label: "能力榜", short: "能力", desc: "全球智能 / 性价比 / 订阅", icon: <Globe className="w-[18px] h-[18px]" /> },
];

interface Props {
  view: View;
  onView: (v: View) => void;
  theme: "light" | "dark";
  onTheme: () => void;
}

export function Sidebar({ view, onView, theme, onTheme }: Props) {
  return (
    <>
      {/* 桌面：左侧固定侧边栏 */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-app bg-surface/60 backdrop-blur-xl">
        {/* Logo */}
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-app">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-glow-card shrink-0">
            <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[14px] font-bold leading-tight text-app tracking-tight truncate">Coding Plan Bench</h1>
            <p className="text-[10px] text-muted leading-tight">模型评测台</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted/70">功能</p>
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => onView(n.id)}
              className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-left"
              style={{ color: view === n.id ? "#fff" : "var(--text)" }}
              data-active={view === n.id}
            >
              {view === n.id && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-primary shadow-glow-card"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10 shrink-0">{n.icon}</span>
              <span className="relative z-10 min-w-0">
                <span className="block text-[13px] font-semibold leading-tight">{n.label}</span>
                <span className={`block text-[10px] leading-tight truncate ${view === n.id ? "text-white" : "text-muted"}`}>{n.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* 底部操作 */}
        <div className="px-3 py-4 border-t border-app space-y-1">
          <button
            onClick={onTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-2 transition-colors cursor-pointer text-muted hover:text-app"
          >
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease }}
              className="inline-block"
            >
              {theme === "light" ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
            </motion.span>
            <span className="text-[13px] font-medium">{theme === "light" ? "深色模式" : "浅色模式"}</span>
          </button>
          <a
            href="https://github.com/TimeCraker/coding-plan-bench"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-2 transition-colors cursor-pointer text-muted hover:text-app"
          >
            <Github className="w-[18px] h-[18px]" />
            <span className="text-[13px] font-medium">GitHub</span>
          </a>
        </div>
      </aside>

      {/* 移动端：顶部横向 nav（替代侧边栏） */}
      <div className="md:hidden sticky top-0 z-30 bg-glass border-b border-app">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-glow-card">
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[13px] font-bold text-app tracking-tight">Coding Plan Bench</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onTheme} className="p-2.5 min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-surface-2 transition-colors cursor-pointer text-muted" aria-label="切换主题">
              {theme === "light" ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
            </button>
            <a href="https://github.com/TimeCraker/coding-plan-bench" target="_blank" rel="noreferrer" className="p-2.5 min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-surface-2 transition-colors cursor-pointer text-muted" aria-label="GitHub（源码仓库）">
              <Github className="w-[18px] h-[18px]" />
            </a>
          </div>
        </div>
        {/* 横向 nav */}
        <div className="flex px-4 pb-2 gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => onView(n.id)}
              className="relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
              style={{ color: view === n.id ? "#fff" : "var(--text-muted)" }}
            >
              {view === n.id && (
                <motion.div layoutId="sidebar-active-m" className="absolute inset-0 rounded-lg bg-primary" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {n.icon}
                {n.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
