import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BenchResult, ProviderSummary } from "../../../bench/types";
import { fmtMs, fmtTps } from "../lib/format";

type Metric = "ttft" | "tps" | "total";

const METRICS: { id: Metric; label: string; unit: string; lowerBetter: boolean }[] = [
  { id: "ttft", label: "TTFT 首 token", unit: "ms", lowerBetter: true },
  { id: "tps", label: "TPS 输出速度", unit: "tok/s", lowerBetter: false },
  { id: "total", label: "Total 总耗时", unit: "ms", lowerBetter: true },
];

export function ComparisonChart({ result }: { result: BenchResult }) {
  const [metric, setMetric] = useState<Metric>("ttft");
  const cfg = METRICS.find((m) => m.id === metric)!;

  const valueOf = (s: ProviderSummary) =>
    metric === "ttft" ? s.ttftMedian : metric === "tps" ? s.tpsMedian : s.totalMedian;

  const vals = result.summary.map(valueOf);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const best = cfg.lowerBetter ? min : max;

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
      {/* 指标切换：shared layoutId 动效 */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h2 className="text-lg font-semibold">指标对比</h2>
        <div className="inline-flex bg-bg rounded-lg p-1 border border-border">
          {METRICS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className="relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer"
              style={{ color: metric === m.id ? "#fff" : "var(--color-muted)" }}
            >
              {metric === m.id && (
                <motion.div
                  layoutId="metric-pill"
                  className="absolute inset-0 rounded-md"
                  style={{ backgroundColor: "var(--color-primary)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 柱状对比 */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={metric}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {result.summary.map((s, i) => {
              const provider = result.providers.find((p) => p.id === s.provider)!;
              const v = valueOf(s);
              const pct = max > 0 ? (v / max) * 100 : 0;
              const isBest = v === best;
              return (
                <div key={s.provider}>
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: provider.color }} />
                      <span className="font-medium">{provider.name}</span>
                      {isBest && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary-soft text-primary font-semibold">
                          最优
                        </span>
                      )}
                    </div>
                    <span className="tabular font-semibold">
                      {metric === "tps" ? fmtTps(v) : fmtMs(v)}
                    </span>
                  </div>
                  <div className="h-9 bg-bg rounded-lg overflow-hidden border border-border">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 + i * 0.08 }}
                      className="h-full rounded-lg flex items-center justify-end pr-2"
                      style={{
                        backgroundColor: provider.color,
                        opacity: isBest ? 1 : 0.55,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="mt-5 text-xs text-muted">
        {cfg.lowerBetter ? "↓ 越低越好" : "↑ 越高越好"} · 中位数（{result.meta.samples} 次取样）·{" "}
        {result.summary.length} 家厂商
      </p>
    </div>
  );
}
