import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Zap, Activity, Timer } from "lucide-react";
import type { BenchApiResponse } from "../lib/api";
import { useCountUp } from "../lib/useCountUp";
import { fmtMs, fmtTps } from "../lib/format";

/** 单次测速结果卡（测完即时显示） */
export function ResultCard({ result }: { result: BenchApiResponse }) {
  if (!result.success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface rounded-2xl border border-app shadow-card p-5 flex items-center gap-3"
      >
        <XCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="font-medium text-app">测速失败</p>
          <p className="text-sm text-muted">{result.error || "未知错误"}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-surface rounded-2xl border border-app shadow-card-lg p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="w-5 h-5 text-primary" />
        <span className="font-medium text-app">测速完成</span>
        {result.samples > 1 && (
          <span className="text-xs text-muted">中位数 · {result.samples} 次</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat
          icon={<Zap className="w-4 h-4" />}
          label="TTFT"
          value={fmtMs(result.ttft)}
          num={result.ttft}
        />
        <Stat
          icon={<Activity className="w-4 h-4" />}
          label="TPS"
          value={`${fmtTps(0)} tok/s`}
          num={0}
          raw={`${fmtTps((result.outputTokens / Math.max(1, result.total - result.ttft)) * 1000)} tok/s`}
        />
        <Stat
          icon={<Timer className="w-4 h-4" />}
          label="Total"
          value={fmtMs(result.total)}
          num={result.total}
        />
      </div>
    </motion.div>
  );
}

function Stat({
  icon,
  label,
  value,
  num,
  raw,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  num: number;
  raw?: string;
}) {
  const numMatch = (raw || value).match(/[\d.]+/);
  const targetNum = numMatch ? parseFloat(numMatch[0]) : num;
  const decimals = numMatch && numMatch[0].includes(".")
    ? numMatch[0].split(".")[1].length
    : 0;
  const animated = useCountUp(targetNum, 700, decimals);
  const display = (raw || value).replace(/[\d.]+/, String(animated));

  return (
    <div className="bg-surface-2 rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-muted text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="tabular text-lg font-bold text-app">{display}</div>
    </div>
  );
}
