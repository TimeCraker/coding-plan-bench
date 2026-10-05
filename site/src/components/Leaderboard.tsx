// 可比较榜单（FR-008 / AC-006 / AUD-007 根治）：
// - 三个互不混排的分区：可比排名（comparability key 分组）/ 示例（demo）/ 遗留（legacy，不可排名）
// - 只有兼容 complete 参与对应 metric 排名；TPS 排名额外要求 provider usage
// - 删除：立即生效 + aria-live 撤销（不自动消失）；清空：稳定确认对话（非 3 秒文字切换）

import { useState } from "react";
import { Trash2, Trophy, Zap, Activity, Timer, Info, Undo2, X } from "lucide-react";
import type { LeaderboardEntryV2 } from "../../../engine/types";
import { fmtMs, fmtTps } from "../lib/format";
import {
  comparabilityKey,
  rankableForMetric,
  type RankableMetric,
} from "../lib/storage";

type Metric = RankableMetric;

const METRICS: {
  id: Metric;
  label: string;
  short: string;
  icon: React.ReactNode;
  lowerBetter: boolean;
  unit: string;
}[] = [
  { id: "ttft", label: "首 token 延迟", short: "TTFT", icon: <Zap className="w-3.5 h-3.5" />, lowerBetter: true, unit: "越低越好" },
  { id: "tps", label: "输出速度", short: "TPS", icon: <Activity className="w-3.5 h-3.5" />, lowerBetter: false, unit: "越高越好 · 需上游 usage" },
  { id: "total", label: "总耗时", short: "Total", icon: <Timer className="w-3.5 h-3.5" />, lowerBetter: true, unit: "越低越好" },
];

interface Props {
  entries: LeaderboardEntryV2[];
  onRemove: (id: string) => { entries: LeaderboardEntryV2[]; removed: LeaderboardEntryV2 | null };
  onRestore: (e: LeaderboardEntryV2) => void;
  onClear: () => void;
  recovery?: "ok" | "corrupt-v2";
  onReset?: () => void;
}

export function Leaderboard({ entries, onRemove, onRestore, onClear, recovery, onReset }: Props) {
  const [metric, setMetric] = useState<Metric>("total");
  const [confirmClear, setConfirmClear] = useState(false);
  const [undoable, setUndoable] = useState<LeaderboardEntryV2 | null>(null);
  const cfg = METRICS.find((m) => m.id === metric)!;

  const rankable = entries.filter((e) => rankableForMetric(e, metric));
  const demos = entries.filter((e) => e.demo);
  const legacy = entries.filter((e) => e.legacy);

  const sorted = [...rankable].sort((a, b) => {
    const va = metricValue(a, metric)!;
    const vb = metricValue(b, metric)!;
    return cfg.lowerBetter ? va - vb : vb - va;
  });
  const max = sorted.length
    ? Math.max(...sorted.map((e) => metricValue(e, metric)!))
    : 0;

  const handleRemove = (id: string) => {
    const { removed } = onRemove(id);
    if (removed) setUndoable(removed);
  };

  const groupKeys = new Set(
    rankable.map((e) => comparabilityKey(e)).filter((k): k is string => k !== null),
  );

  return (
    <div
      className="anim-fade-up bg-surface rounded-2xl border border-app shadow-lg-card overflow-hidden"
      data-testid="leaderboard"
    >
      {/* 头部：标题 + 指标切换 + 清空 */}
      <div className="px-5 md:px-6 py-4 border-b border-app bg-surface-2/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-app leading-tight">速度榜单</h2>
              <p className="text-[11px] text-muted leading-tight">
                可比 {rankable.length} 条 · 示例 {demos.length} 条 · 遗留 {legacy.length} 条
                {groupKeys.size > 1 ? ` · ${groupKeys.size} 个条件组` : ""}
              </p>
            </div>
          </div>
          {entries.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmClear ? (
                <span
                  role="alertdialog"
                  aria-label="确认清空榜单"
                  className="inline-flex items-center gap-2 text-xs"
                >
                  <span className="text-muted">确认清空全部记录？</span>
                  <button
                    onClick={() => { onClear(); setConfirmClear(false); }}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-500 font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
                    data-testid="confirm-clear-yes"
                  >
                    确认清空
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-2 border border-app text-muted hover:text-app transition-colors cursor-pointer"
                    data-testid="confirm-clear-no"
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-muted hover:text-red-500 transition-colors cursor-pointer inline-flex items-center gap-1"
                  data-testid="clear-all"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  清空全部
                </button>
              )}
            </div>
          )}
        </div>

        {/* 指标切换（同一条件组内按当前指标排序） */}
        <div className="mt-4 space-y-2">
          <div className="w-full overflow-x-auto">
          <div
            className="inline-flex bg-surface-2 rounded-lg p-0.5 border border-app"
            role="tablist"
            aria-label="排序指标"
          >
            {METRICS.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={metric === m.id}
                onClick={() => setMetric(m.id)}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  metric === m.id ? "bg-primary text-white" : "text-muted hover:text-app"
                }`}
              >
                {m.icon}
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.short}</span>
              </button>
            ))}
          </div>
          </div>
          <span className="block text-[11px] text-muted tabular">
            排序：{cfg.label} · <span className="text-primary font-medium">{cfg.unit} {cfg.lowerBetter ? "↓" : "↑"}</span>
          </span>
        </div>
      </div>

      {/* 撤销 toast（稳定存在直到用户处理，aria-live 播报） */}
      {undoable && (
          <div
            role="status"
            aria-live="polite"
            className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl bg-primary-soft border border-primary/20 px-3.5 py-2.5 text-xs"
            data-testid="undo-toast"
          >
            <span className="flex-1 text-app">已删除「{undoable.label}」</span>
            <button
              onClick={() => { onRestore(undoable); setUndoable(null); }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors cursor-pointer"
              data-testid="undo-button"
            >
              <Undo2 className="w-3 h-3" aria-hidden="true" />
              撤销
            </button>
            <button
              onClick={() => setUndoable(null)}
              aria-label="关闭撤销提示"
              className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-surface transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
      )}

      {/* 损坏数据隔离提示 */}
      {recovery === "corrupt-v2" && (
        <div role="alert" className="m-3 rounded-xl bg-orange-500/10 border border-orange-500/30 p-3.5 text-xs text-app">
          本地榜单数据损坏，已隔离显示（原值未被覆盖）。
          <button
            onClick={onReset}
            className="ml-2 px-2.5 py-1.5 rounded-lg bg-surface border border-app text-muted hover:text-red-500 transition-colors cursor-pointer"
            data-testid="reset-local"
          >
            重置本地数据
          </button>
        </div>
      )}

      {/* 分区一：可比排名 */}
      <div className="p-3 md:p-3">
        <SectionLabel>可比排名（同 profile · 同测量版本 · 同执行位置 · 完整结果）</SectionLabel>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            还没有可比较的记录——完成一次测速后会出现在这里
          </p>
        ) : (
          <ul className="space-y-2">
              {sorted.map((e, i) => (
                <Row
                  key={e.id}
                  entry={e}
                  rank={i + 1}
                  metric={metric}
                  pct={max > 0 ? ((metricValue(e, metric) ?? 0) / max) * 100 : 0}
                  best={i === 0}
                  onRemove={handleRemove}
                />
              ))}
          </ul>
        )}

        {/* 分区二：示例数据（独立，不参与上方排名） */}
        {demos.length > 0 && (
          <>
            <SectionLabel>
              <Info className="w-3 h-3 inline -mt-0.5" aria-hidden="true" />
              示例数据（独立分区，不参与可比排名）
            </SectionLabel>
            <ul className="space-y-2 opacity-80">
              {demos.map((e) => (
                <Row key={e.id} entry={e} metric={metric} demo onRemove={handleRemove} />
              ))}
            </ul>
          </>
        )}

        {/* 分区三：遗留数据（v1 迁移，不可排名） */}
        {legacy.length > 0 && (
          <>
            <SectionLabel>遗留数据（旧版本记录 · 无执行位置与 profile 信息 · 不可排名）</SectionLabel>
            <ul className="space-y-2 opacity-75">
              {legacy.map((e) => (
                <Row key={e.id} entry={e} metric={metric} legacy onRemove={handleRemove} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted/70 px-1 pt-3 pb-1.5">
      {children}
    </p>
  );
}

function metricValue(e: LeaderboardEntryV2, m: Metric): number | null {
  if (e.run) {
    if (m === "ttft") return e.run.aggregate.ttftMs;
    if (m === "tps") return e.run.aggregate.tps;
    return e.run.aggregate.totalMs;
  }
  if (e.legacyMetrics) {
    if (m === "ttft") return e.legacyMetrics.ttft;
    if (m === "tps") return e.legacyMetrics.tps;
    return e.legacyMetrics.total;
  }
  return null;
}

function Row({
  entry,
  rank,
  metric,
  pct,
  best,
  demo,
  legacy,
  onRemove,
}: {
  entry: LeaderboardEntryV2;
  rank?: number;
  metric: Metric;
  pct?: number;
  best?: boolean;
  demo?: boolean;
  legacy?: boolean;
  onRemove: (id: string) => void;
}) {
  const v = metricValue(entry, metric);
  const provenance = entry.run
    ? `${entry.run.profile.id}@${entry.run.profile.version} · ${entry.run.transport}`
    : legacy
      ? "旧记录 · 条件未知"
      : "";
  return (
    <li
      className="anim-fade-up relative bg-surface-2 rounded-xl overflow-hidden border border-app hover:border-strong transition-colors"
    >
      {pct !== undefined && pct > 0 && (
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: best
              ? "linear-gradient(90deg, var(--primary), transparent)"
              : "linear-gradient(90deg, var(--border-strong), transparent)",
            opacity: best ? 0.1 : 0.05,
          }}
        />
      )}
      <div className="relative p-3.5 md:grid md:grid-cols-[2.5rem_1fr_auto_2.5rem] md:items-center md:gap-3 flex items-center gap-3">
        <div className="flex items-center justify-center w-8 shrink-0 tabular text-sm font-bold text-muted">
          {rank ? `#${rank}` : "—"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-app truncate">{entry.label || entry.model}</span>
            {best && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary text-white font-semibold shrink-0">
                本组最优
              </span>
            )}
            {demo && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface border border-app shrink-0" style={{ color: "var(--text)" }}>
                示例
              </span>
            )}
            {legacy && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface border border-app shrink-0" style={{ color: "var(--text)" }}>
                遗留 · 不可排名
              </span>
            )}
          </div>
          <div className="text-[11px] truncate tabular mt-0.5" style={{ color: "var(--text)" }}>
            {entry.model} · {entry.requestUrlDisplay.replace(/^https?:\/\//, "").split("/")[0]}
            {provenance ? ` · ${provenance}` : ""}
          </div>
          {/* 三指标横排（移动端） */}
          <div className="flex items-center gap-3 mt-1.5 md:hidden text-[11px] tabular">
            <span className="text-muted">TTFT <span className="text-app">{fmtMs(metricValue(entry, "ttft") ?? 0)}</span></span>
            <span className="text-muted">TPS <span className="text-app">{entry.run?.aggregate.tps == null && !legacy ? "—" : fmtTps(metricValue(entry, "tps") ?? 0)}</span></span>
            <span className="text-muted">Total <span className="text-app">{fmtMs(metricValue(entry, "total") ?? 0)}</span></span>
          </div>
        </div>
        <div className="text-right shrink-0 md:min-w-[90px]">
          <div
            className="tabular text-2xl font-bold leading-none"
            style={{ color: best ? "var(--primary)" : "var(--text)" }}
          >
            {v === null ? "—" : metric === "tps" ? fmtTps(v) : fmtMs(v)}
          </div>
        </div>
        <div className="flex items-center justify-center w-8 shrink-0">
          <button
            onClick={() => onRemove(entry.id)}
            className="p-2.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center rounded-lg text-muted hover:text-red-500 hover:bg-surface transition-colors cursor-pointer"
            aria-label={`删除 ${entry.label || entry.model}`}
            data-testid="remove-entry"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}
