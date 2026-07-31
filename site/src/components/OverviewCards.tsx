import { motion } from "framer-motion";
import { Trophy, Zap, Timer, Activity } from "lucide-react";
import type { BenchResult, ProviderSummary } from "../../../bench/types";
import { useCountUp } from "../lib/useCountUp";
import { fmtMs, fmtTps } from "../lib/format";

interface Props {
  result: BenchResult;
}

export function OverviewCards({ result }: Props) {
  const { summary, providers } = result;

  // TTFT 最低 = 响应最快
  const ttftWinner = [...summary].sort((a, b) => a.ttftMedian - b.ttftMedian)[0];
  // TPS 最高 = 输出最快
  const tpsWinner = [...summary].sort((a, b) => b.tpsMedian - a.tpsMedian)[0];
  // wins 最多 = 综合最佳
  const overallWinner = [...summary].sort((a, b) => b.wins - a.wins)[0];

  const name = (s: ProviderSummary) =>
    providers.find((p) => p.id === s.provider)?.name ?? s.provider;
  const color = (s: ProviderSummary) =>
    providers.find((p) => p.id === s.provider)?.color ?? "#2563EB";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <WinnerCard
        icon={<Zap className="w-5 h-5" />}
        label="响应最快 · TTFT"
        winnerName={name(ttftWinner)}
        winnerColor={color(ttftWinner)}
        value={fmtMs(ttftWinner.ttftMedian)}
        hint="首 token 延迟最低"
        delay={0}
      />
      <WinnerCard
        icon={<Activity className="w-5 h-5" />}
        label="输出最快 · TPS"
        winnerName={name(tpsWinner)}
        winnerColor={color(tpsWinner)}
        value={`${fmtTps(tpsWinner.tpsMedian)} tok/s`}
        hint="token 输出效率最高"
        delay={0.08}
      />
      <WinnerCard
        icon={<Trophy className="w-5 h-5" />}
        label="综合最佳 · Wins"
        winnerName={name(overallWinner)}
        winnerColor={color(overallWinner)}
        value={`${overallWinner.wins}/${result.prompts.length}`}
        hint="在最多 prompt 上总耗时最短"
        delay={0.16}
      />
    </div>
  );
}

function WinnerCard({
  icon,
  label,
  winnerName,
  winnerColor,
  value,
  hint,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  winnerName: string;
  winnerColor: string;
  value: string;
  hint: string;
  delay: number;
}) {
  // 提取数字用于 count-up
  const numMatch = value.match(/[\d.]+/);
  const num = numMatch ? parseFloat(numMatch[0]) : 0;
  const decimals = numMatch && numMatch[0].includes(".") ? numMatch[0].split(".")[1].length : 0;
  const animated = useCountUp(num, 700, decimals);
  const display = value.replace(/[\d.]+/, String(animated));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
      whileHover={{ y: -2 }}
      className="bg-surface rounded-2xl border border-border shadow-sm p-5 cursor-default"
      style={{ borderTop: `3px solid ${winnerColor}` }}
    >
      <div className="flex items-center gap-2 text-muted text-sm font-medium">
        <span style={{ color: winnerColor }}>{icon}</span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight" style={{ color: winnerColor }}>
        {winnerName}
      </div>
      <div className="mt-1 text-3xl font-bold tabular">{display}</div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </motion.div>
  );
}
