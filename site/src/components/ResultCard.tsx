import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Zap, Activity, Timer, Brain } from "lucide-react";
import type { BenchApiResponse } from "../lib/api";
import { useCountUp } from "../lib/useCountUp";
import { fmtMs, fmtTps } from "../lib/format";

const ease = [0.16, 1, 0.3, 1] as const;

export function ResultCard({ result }: { result: BenchApiResponse }) {
  if (!result.success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="bg-surface rounded-2xl border border-app shadow-md-card p-5 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
          <XCircle className="w-5 h-5 text-red-500" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-app">测速失败</p>
          <p className="text-sm text-muted truncate">{result.error || "未知错误"}</p>
        </div>
      </motion.div>
    );
  }

  const tps = Math.round((result.outputTokens / Math.max(1, result.total - result.ttft)) * 1000 * 10) / 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease }}
      className="bg-surface rounded-2xl border border-app shadow-lg-card overflow-hidden"
    >
      <div className="px-5 md:px-6 py-4 border-b border-app flex items-center gap-2.5 bg-surface-2/50">
        <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-4.5 h-4.5 text-success" />
        </div>
        <span className="font-semibold text-app">测速完成</span>
        {result.samples > 1 && (
          <span className="text-xs text-muted">中位数 · {result.samples} 次</span>
        )}
        {result.thinkingMs && result.thinkingMs > 0 ? (
          <span className="ml-auto text-xs text-muted inline-flex items-center gap-1">
            <Brain className="w-3 h-3" />思考 {fmtMs(result.thinkingMs)}
          </span>
        ) : null}
      </div>
      <div className="p-5 md:p-6 grid grid-cols-3 gap-3">
        <Stat icon={<Zap className="w-4 h-4" />} label="TTFT" sub="首 token"
          value={fmtMs(result.ttft)} num={result.ttft} delay={0} />
        <Stat icon={<Activity className="w-4 h-4" />} label="TPS" sub="输出速度"
          value={`${fmtTps(tps)}`} suffix=" tokens/s" num={tps} decimals={1} delay={0.08} highlight />
        <Stat icon={<Timer className="w-4 h-4" />} label="Total" sub="总耗时"
          value={fmtMs(result.total)} num={result.total} delay={0.16} />
      </div>
    </motion.div>
  );
}

function Stat({
  icon, label, sub, value, num, suffix, decimals = 0, delay = 0, highlight = false,
}: {
  icon: React.ReactNode; label: string; sub: string; value: string; num: number;
  suffix?: string; decimals?: number; delay?: number; highlight?: boolean;
}) {
  const m = value.match(/[\d.]+/);
  const target = m ? parseFloat(m[0]) : num;
  const dec = m && m[0].includes(".") ? m[0].split(".")[1].length : decimals;
  const animated = useCountUp(target, 800, dec);
  const display = value.replace(/[\d.]+/, String(animated)) + (suffix || "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay }}
      className={`rounded-xl p-4 border ${highlight ? "bg-primary-soft border-primary/20" : "bg-surface-2 border-app"}`}
    >
      <div className="flex items-center gap-1.5 text-muted text-[11px] mb-2">
        <span className={highlight ? "text-primary" : ""}>{icon}</span>
        <span className="font-medium">{label}</span>
        <span className="opacity-60">· {sub}</span>
      </div>
      <div className={`tabular text-2xl font-bold ${highlight ? "text-primary" : "text-app"}`}>
        {display}
      </div>
    </motion.div>
  );
}
