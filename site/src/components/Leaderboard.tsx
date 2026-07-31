import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Trophy, Zap, Activity, Timer, Sparkles } from "lucide-react";
import type { LeaderboardEntry } from "../../../engine/types";
import { fmtMs, fmtTps, fmtTime } from "../lib/format";
import { isSeed } from "../lib/storage";

type Metric = "ttft" | "tps" | "total";

const METRICS: {
  id: Metric;
  label: string;
  short: string;
  icon: React.ReactNode;
  lowerBetter: boolean;
}[] = [
  { id: "ttft", label: "首 token 延迟", short: "TTFT", icon: <Zap className="w-3.5 h-3.5" />, lowerBetter: true },
  { id: "tps", label: "输出速度", short: "TPS", icon: <Activity className="w-3.5 h-3.5" />, lowerBetter: false },
  { id: "total", label: "总耗时", short: "Total", icon: <Timer className="w-3.5 h-3.5" />, lowerBetter: true },
];

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#b45309"]; // 金/银/铜

interface Props {
  entries: LeaderboardEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
  highlightId?: string;
}

export function Leaderboard({ entries, onRemove, onClear, highlightId }: Props) {
  const [metric, setMetric] = useState<Metric>("total");
  const cfg = METRICS.find((m) => m.id === metric)!;
  const [confirmClear, setConfirmClear] = useState(false);

  const sorted = [...entries].sort((a, b) =>
    cfg.lowerBetter ? val(a, metric) - val(b, metric) : val(b, metric) - val(a, metric),
  );
  const best = sorted[0];
  const bestVal = best ? val(best, metric) : 0;
  const max = sorted.length ? Math.max(...sorted.map((e) => val(e, metric))) : 0;
  const hasSeed = entries.some((e) => isSeed(e.id));

  return (
    <div className="bg-surface rounded-2xl border border-app shadow-card overflow-hidden">
      {/* 头部 */}
      <div className="p-5 md:p-6 pb-4 border-b border-app">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center">
              <Trophy className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-app leading-tight">速度榜单</h2>
              <p className="text-xs text-muted leading-tight">
                {entries.length} 条记录{hasSeed ? " · 含示例数据" : ""}
              </p>
            </div>
          </div>
          {entries.length > 0 && (
            <button
              onClick={() => {
                if (confirmClear) {
                  onClear();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                  setTimeout(() => setConfirmClear(false), 3000);
                }
              }}
              className="text-xs text-muted hover:text-red-500 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmClear ? "确认清空？" : "清空全部"}
            </button>
          )}
        </div>

        {/* 指标切换 */}
        <div className="inline-flex bg-surface-2 rounded-lg p-0.5 border border-app mt-4">
          {METRICS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer"
              style={{ color: metric === m.id ? "#fff" : "var(--text-muted)" }}
            >
              {metric === m.id && (
                <motion.div
                  layoutId="metric-pill"
                  className="absolute inset-0 rounded-md bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                {m.icon}
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.short}</span>
                <span className="text-[10px] opacity-70">{cfg.lowerBetter === m.lowerBetter ? (m.lowerBetter ? "↓" : "↑") : ""}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      <div className="p-4 md:p-5">
        {entries.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">
            还没有记录，填上面表单测一个吧
          </p>
        ) : (
          <motion.ul layout className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {sorted.map((e, i) => {
                const v = val(e, metric);
                const pct = max > 0 ? (v / max) * 100 : 0;
                const isBest = v === bestVal;
                const seed = isSeed(e.id);
                const isHi = e.id === highlightId;
                const rankColor = i < 3 ? RANK_COLORS[i] : "var(--text-muted)";
                return (
                  <motion.li
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      boxShadow: isHi ? "0 0 0 2px var(--primary)" : "none",
                    }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="relative bg-surface-2 rounded-xl overflow-hidden group"
                  >
                    {/* 左侧排名色条 */}
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: rankColor }} />

                    {/* 背景进度条 */}
                    <motion.div
                      className="absolute left-1 top-0 bottom-0"
                      style={{ backgroundColor: "var(--primary)", opacity: isBest ? 0.12 : 0.06 }}
                      initial={{ width: 0 }}
                      animate={{ width: `calc(${pct}% - 4px)` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />

                    {/* 内容 */}
                    <div className="relative p-3.5 pl-5 flex items-center gap-3">
                      {/* 排名 */}
                      <div className="flex flex-col items-center w-7 shrink-0">
                        {i < 3 ? (
                          <Trophy className="w-4 h-4" style={{ color: rankColor }} />
                        ) : null}
                        <span className="tabular text-xs font-bold" style={{ color: rankColor }}>
                          #{i + 1}
                        </span>
                      </div>

                      {/* 名称 + 元信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-app truncate">{e.label || e.model}</span>
                          {isBest && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-soft text-primary font-semibold shrink-0 inline-flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />最优
                            </span>
                          )}
                          {seed && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-app text-muted shrink-0">
                              示例
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted truncate tabular mt-0.5">
                          {e.model} · {e.endpoint.replace(/^https?:\/\//, "").split("/")[0]}
                        </div>
                        {/* 三个指标小字 */}
                        <div className="flex items-center gap-2.5 mt-1.5 text-[10px] tabular text-muted">
                          <span className={metric === "ttft" ? "text-primary font-semibold" : ""}>
                            TTFT {fmtMs(e.ttft)}
                          </span>
                          <span className={metric === "tps" ? "text-primary font-semibold" : ""}>
                            TPS {fmtTps(e.tps)}
                          </span>
                          <span className={metric === "total" ? "text-primary font-semibold" : ""}>
                            Total {fmtMs(e.total)}
                          </span>
                          <span className="opacity-60">{fmtTime(e.ranAt)}</span>
                        </div>
                      </div>

                      {/* 主数值 */}
                      <div className="text-right shrink-0">
                        <div className="tabular text-xl font-bold leading-none" style={{ color: isBest ? "var(--primary)" : "var(--text)" }}>
                          {metric === "tps" ? fmtTps(v) : fmtMs(v)}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">
                          {metric === "tps" ? "tok/s" : cfg.lowerBetter ? "越低越好" : ""}
                        </div>
                      </div>

                      {/* 删除 */}
                      <button
                        onClick={() => onRemove(e.id)}
                        className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-surface transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
                        aria-label="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </div>
  );
}

function val(e: LeaderboardEntry, m: Metric): number {
  return m === "ttft" ? e.ttft : m === "tps" ? e.tps : e.total;
}
