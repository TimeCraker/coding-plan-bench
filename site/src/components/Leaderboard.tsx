import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Trophy, Zap, Activity, Timer } from "lucide-react";
import type { LeaderboardEntry } from "../../../engine/types";
import { fmtMs, fmtTps, fmtTime } from "../lib/format";

type Metric = "ttft" | "tps" | "total";

const METRICS: {
  id: Metric;
  label: string;
  icon: React.ReactNode;
  lowerBetter: boolean;
}[] = [
  { id: "ttft", label: "TTFT 首 token", icon: <Zap className="w-3.5 h-3.5" />, lowerBetter: true },
  { id: "tps", label: "TPS 输出速度", icon: <Activity className="w-3.5 h-3.5" />, lowerBetter: false },
  { id: "total", label: "Total 总耗时", icon: <Timer className="w-3.5 h-3.5" />, lowerBetter: true },
];

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
    cfg.lowerBetter
      ? val(a, metric) - val(b, metric)
      : val(b, metric) - val(a, metric),
  );

  const best = sorted[0];
  const bestVal = best ? val(best, metric) : 0;
  const max = sorted.length ? Math.max(...sorted.map((e) => val(e, metric))) : 0;

  return (
    <div className="bg-surface rounded-2xl border border-app shadow-card p-5 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-cta" />
          <h2 className="text-lg font-semibold">速度榜单</h2>
          <span className="text-xs text-muted">{entries.length} 条</span>
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

      {/* 指标 tab */}
      <div className="inline-flex bg-surface-2 rounded-lg p-0.5 border border-app mb-4">
        {METRICS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMetric(m.id)}
            className="relative inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer"
            style={{ color: metric === m.id ? "#fff" : "var(--text-muted)" }}
          >
            {metric === m.id && (
              <motion.div
                layoutId="metric-pill"
                className="absolute inset-0 rounded-md bg-primary"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1">
              {m.icon}
              {m.label}
            </span>
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">
          还没有测速记录，填上面表单测一个吧
        </p>
      ) : (
        <motion.ul layout className="space-y-2">
          <AnimatePresence mode="popLayout">
            {sorted.map((e, i) => {
              const v = val(e, metric);
              const pct = max > 0 ? (v / max) * 100 : 0;
              const isBest = v === bestVal;
              const isHi = e.id === highlightId;
              return (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    boxShadow: isHi ? "0 0 0 2px var(--primary)" : "none",
                  }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="relative bg-surface-2 rounded-xl p-3 overflow-hidden"
                >
                  {/* 排名条 */}
                  <div className="flex items-center gap-3 relative z-10">
                    <span
                      className="tabular text-sm font-bold w-6 text-center"
                      style={{ color: i === 0 ? "var(--cta)" : "var(--text-muted)" }}
                    >
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-app truncate">
                          {e.label || e.model}
                        </span>
                        {isBest && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-soft text-primary font-semibold shrink-0">
                            最优
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted truncate tabular">
                        {e.model} · {e.endpoint.replace(/^https?:\/\//, "").split("/")[0]}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="tabular font-bold text-app">
                        {metric === "tps" ? fmtTps(v) : fmtMs(v)}
                      </div>
                      <div className="text-[10px] text-muted">
                        {metric === "tps" ? "tok/s" : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(e.id)}
                      className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-surface transition-colors cursor-pointer shrink-0"
                      aria-label="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* 背景进度条 */}
                  <motion.div
                    className="absolute left-0 top-0 bottom-0 opacity-10"
                    style={{ backgroundColor: "var(--primary)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                  <div className="text-[10px] text-muted mt-1 relative z-10 tabular">
                    {fmtTime(e.ranAt)} · TTFT {fmtMs(e.ttft)} / TPS {fmtTps(e.tps)} / Total {fmtMs(e.total)}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}

function val(e: LeaderboardEntry, m: Metric): number {
  return m === "ttft" ? e.ttft : m === "tps" ? e.tps : e.total;
}
