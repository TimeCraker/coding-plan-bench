// 可比较榜单（FR-008 / AC-006 / AUD-007 根治）：
// - 三个互不混排的分区：可比排名（comparability key 分组）/ 示例（demo）/ 遗留（legacy，不可排名）
// - 只有兼容 complete 参与对应 metric 排名；TPS 排名额外要求 provider usage
// - 删除：立即生效 + aria-live 恢复（不自动消失）；清空：稳定确认对话（非 3 秒文字切换）
// - Swiss Industrial Print：行式列表 + 左侧 4px 状态色轨 + 固定列基准宽（列对齐铁律：
//   每列固定 flex-basis + min-width:0 + 内容省略，宽度由基准决定、与内容无关）
// - 成绩公报制式：前三名 rank 大数字（#1 珊瑚 + 底部短规线）、本组最优值珊瑚下划规线、
//   列内单位恒定（TTFT 恒 ms / Total 恒 s，EYE P2-1）

import { useState, type ReactNode } from "react";
import type {
  LeaderboardEntryV2,
  RunStatus,
  TransportKind,
} from "../../../engine/types";
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
  lowerBetter: boolean;
  unit: string;
}[] = [
  { id: "ttft", label: "首 token 延迟", short: "TTFT", lowerBetter: true, unit: "越低越好" },
  { id: "tps", label: "输出速度", short: "TPS", lowerBetter: false, unit: "越高越好 · 需上游 usage" },
  { id: "total", label: "总耗时", short: "Total", lowerBetter: true, unit: "越低越好" },
];

/** 状态色轨（语义即颜色）：完整=ok / 部分成功=warn / 失败=bad / 已取消=mute；遗留恒 mute */
const STATUS_RAIL: Record<RunStatus, string> = {
  complete: "bg-ok",
  partial: "bg-warn",
  failed: "bg-bad",
  cancelled: "bg-mute",
};

/** transport 来源徽章文案 */
const TRANSPORT_SHORT: Record<TransportKind, string> = {
  "browser-direct": "直连",
  "trusted-proxy": "代理",
  "tauri-local": "本地",
};

/* mono 描边小方钮：hover 墨底/语义色反白 */
const BTN_BASE =
  "font-mono text-[11px] font-semibold px-2.5 py-1.5 border cursor-pointer bg-panel transition-colors duration-200";
const BTN_NEUTRAL = `${BTN_BASE} border-line-2 text-ink-2 hover:bg-ink hover:border-ink hover:text-panel`;
const BTN_DANGER = `${BTN_BASE} border-bad text-bad hover:bg-bad hover:text-panel`;
const BTN_ACCENT = `${BTN_BASE} border-accent text-accent hover:bg-accent hover:text-panel`;

/** 桌面列基准宽（列头与条目行共用同一份，保证行行对齐） */
const COL_RANK = "flex-[0_0_44px] md:flex-[0_0_56px]";
const COL_MAIN = "flex-1 md:flex-[1_1_320px] min-w-0";
const COL_ACTION = "flex-[0_0_44px] md:flex-[0_0_64px]";
const METRIC_COL: Record<Metric, string> = {
  ttft: "md:flex-[0_0_92px]",
  tps: "md:flex-[0_0_76px]",
  total: "md:flex-[0_0_92px]",
};
const COL_TRANSPORT = "md:flex-[0_0_72px]";

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

  const handleRemove = (id: string) => {
    const { removed } = onRemove(id);
    if (removed) setUndoable(removed);
  };

  const groupKeys = new Set(
    rankable.map((e) => comparabilityKey(e)).filter((k): k is string => k !== null),
  );

  return (
    <section
      className="anim-fade-up bg-panel border-[1.5px] border-ink hard-shadow"
      data-testid="leaderboard"
    >
      {/* 头部：编号制 mono 区块标题（03 序列 = 执行位置 01 / 表单 02 之后）+ 发丝延伸线 + 右侧操作 */}
      <header className="px-4 pt-4 md:px-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="lbl-mono flex min-w-0 flex-1 items-center gap-3">
          <span className="whitespace-nowrap">
            <span className="text-accent">03</span> · LEADERBOARD · 本机榜单
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-line-2" />
        </h2>
        {entries.length > 0 &&
          (confirmClear ? (
            <span role="alertdialog" aria-label="确认清空榜单" className="flex items-center gap-2">
              <span className="text-xs text-ink-2">确认清空全部记录？</span>
              <button
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                }}
                className={BTN_DANGER}
                data-testid="confirm-clear-yes"
              >
                确认清空
              </button>
              <button onClick={() => setConfirmClear(false)} className={BTN_NEUTRAL} data-testid="confirm-clear-no">
                取消
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmClear(true)} className={BTN_NEUTRAL} data-testid="clear-all">
              清空全部
            </button>
          ))}
      </header>
      {/* 计数行制式：每段 = 数值（600 墨）+ 标签（ink-3），段间 mono 中点分隔 */}
      <p className="mt-2 px-4 font-mono text-[11px] tabular tracking-[0.02em] md:px-5">
        <span className="text-ink-3">可比 </span>
        <span className="font-semibold text-ink">{rankable.length}</span>
        <span className="text-ink-3"> 条 · 示例 </span>
        <span className="font-semibold text-ink">{demos.length}</span>
        <span className="text-ink-3"> 条 · 遗留 </span>
        <span className="font-semibold text-ink">{legacy.length}</span>
        <span className="text-ink-3"> 条</span>
        {groupKeys.size > 1 && (
          <>
            <span className="text-ink-3"> · </span>
            <span className="font-semibold text-ink">{groupKeys.size}</span>
            <span className="text-ink-3"> 个条件组</span>
          </>
        )}
      </p>

      {/* 排序指标 tablist：2px 墨底线，选中态珊瑚底线与墨线对齐（agent-hive .tab 式） */}
      <div className="mt-3 overflow-x-auto">
        <div className="flex w-max min-w-full border-b-2 border-ink" role="tablist" aria-label="排序指标">
          {METRICS.map((m) => {
            const on = metric === m.id;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={on}
                onClick={() => setMetric(m.id)}
                className={`-mb-[2px] flex items-baseline gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 cursor-pointer transition-colors duration-200 ${
                  on ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                <span className="font-mono text-[11px] font-bold tracking-wide">{m.short}</span>
                <span className="hidden text-[13px] font-medium sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="px-4 pt-2.5 font-mono text-[11px] text-ink-3 tabular md:px-5">
        排序：{cfg.label} ·{" "}
        <span className="font-semibold text-ink-2">
          {cfg.unit} {cfg.lowerBetter ? "↓" : "↑"}
        </span>
      </p>

      {/* 恢复 toast（稳定存在直到用户处理，aria-live 播报） */}
      {undoable && (
        <div
          role="status"
          aria-live="polite"
          className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border border-line-2 bg-panel-2 px-3.5 py-2.5 md:mx-5"
          data-testid="undo-toast"
        >
          <span className="min-w-[140px] flex-1 text-[12.5px] text-ink">已删除「{undoable.label}」</span>
          <button
            onClick={() => {
              onRestore(undoable);
              setUndoable(null);
            }}
            className={BTN_ACCENT}
            data-testid="undo-button"
          >
            恢复
          </button>
          <button
            onClick={() => setUndoable(null)}
            aria-label="关闭撤销提示"
            className="cursor-pointer px-1.5 font-mono text-[13px] leading-none text-ink-3 transition-colors duration-200 hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      {/* 损坏数据隔离提示 */}
      {recovery === "corrupt-v2" && (
        <div
          role="alert"
          className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border border-dashed border-warn px-3.5 py-2.5 md:mx-5"
        >
          <span className="min-w-[200px] flex-1 text-[12.5px] text-ink-2">
            本地榜单数据损坏，已隔离显示（原值未被覆盖）。
          </span>
          <button onClick={onReset} className={BTN_DANGER} data-testid="reset-local">
            重置本地数据
          </button>
        </div>
      )}

      {/* 分区一：可比排名 */}
      <div className="px-4 pb-4 pt-1 md:px-5">
        <SectionLabel>可比排名（同 profile · 同测量版本 · 同执行位置 · 完整结果）</SectionLabel>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border border-dashed border-line-2 py-12">
            <span className="border border-accent px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              NO DATA
            </span>
            <span aria-hidden="true" className="font-mono text-[10px] tracking-[0.14em] text-ink-3">
              — AWAITING FIRST RUN —
            </span>
            <p className="text-[13px] text-ink-3">还没有可比较的记录——完成一次测速后会出现在这里</p>
            <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3">RUN #001 · 待产生</span>
          </div>
        ) : (
          <ul className="border border-line-2">
            <ColumnHeader metric={metric} />
            {sorted.map((e, i) => (
              <Row
                key={e.id}
                entry={e}
                rank={i + 1}
                metric={metric}
                best={i === 0}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        )}

        {/* 分区二：示例数据（独立，不参与上方排名） */}
        {demos.length > 0 && (
          <>
            <SectionLabel>示例数据（独立分区，不参与可比排名）</SectionLabel>
            <ul className="border border-line-2">
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
            <ul className="border border-line-2">
              {legacy.map((e) => (
                <Row key={e.id} entry={e} metric={metric} legacy onRemove={handleRemove} />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="lbl-mono flex items-center gap-3 pb-2 pt-4">
      <span className="min-w-0">{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}

/** 桌面列头（与条目行共用列基准；移动端隐藏，改由每个指标单元格内联 mono 小标）。
 *  当前排序指标列珊瑚强调（与最优值下划规线呼应）；与首行间距 mb-2 */
function ColumnHeader({ metric }: { metric: Metric }) {
  const base = "py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]";
  const lbl = `${base} text-ink-3`;
  const lblOn = `${base} text-accent`;
  return (
    <div aria-hidden="true" className="mb-2 hidden border-b border-line bg-panel-2 md:flex">
      <span className="w-[4px] flex-none" />
      <span className={`${COL_RANK} ${lbl} text-center`}>#</span>
      <span className={`${COL_MAIN} ${lbl}`}>条目</span>
      <span className={`${METRIC_COL.ttft} ${metric === "ttft" ? lblOn : lbl} pr-4 text-right`}>TTFT</span>
      <span className={`${METRIC_COL.tps} ${metric === "tps" ? lblOn : lbl} pr-4 text-right`}>TPS</span>
      <span className={`${METRIC_COL.total} ${metric === "total" ? lblOn : lbl} pr-4 text-right`}>TOTAL</span>
      <span className={`${COL_TRANSPORT} ${lbl} text-center`}>来源</span>
      <span className={COL_ACTION} />
    </div>
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

/** 单元格文案：缺数据即「—」（不伪装）；legacy 的 TPS 沿用旧值展示；
 *  列内单位恒定（EYE P2-1）：TTFT 恒 ms、Total 恒 s，同列不再 ms/s 混排 */
function metricCellText(e: LeaderboardEntryV2, m: Metric): string {
  if (m === "tps" && e.run?.aggregate.tps == null && !e.legacy) return "—";
  const v = metricValue(e, m);
  if (v === null) return "—";
  if (m === "tps") return fmtTps(v);
  return fmtMs(v, m === "ttft" ? "ms" : "s");
}

function Row({
  entry,
  rank,
  metric,
  best,
  demo,
  legacy,
  onRemove,
}: {
  entry: LeaderboardEntryV2;
  rank?: number;
  metric: Metric;
  best?: boolean;
  demo?: boolean;
  legacy?: boolean;
  onRemove: (id: string) => void;
}) {
  const rail = legacy ? "bg-mute" : entry.run ? STATUS_RAIL[entry.run.status] : "bg-mute";
  const host = entry.requestUrlDisplay.replace(/^https?:\/\//, "").split("/")[0];
  const provenance = entry.run
    ? ` · ${entry.run.profile.id}@${entry.run.profile.version}`
    : legacy
      ? " · 旧记录 · 条件未知"
      : "";
  const dim = legacy;

  return (
    <li className="anim-fade-in flex flex-wrap items-stretch border-b border-line transition-colors duration-150 last:border-b-0 hover:bg-panel-2">
      {/* 左侧状态色轨 */}
      <span aria-hidden="true" className={`w-[4px] flex-none ${rail}`} />
      {/* 排名：前三名戏剧化大数字（#1 珊瑚 + 底部 3px 短规线 / #2 #3 墨 600），其余次级 */}
      <div className={`${COL_RANK} flex items-center justify-center`}>
        {rank ? (
          <span className="relative inline-flex flex-col items-center">
            <span
              className={
                rank <= 3
                  ? `font-mono tabular tracking-tighter text-2xl leading-none ${
                      best ? "font-bold text-accent" : "font-semibold text-ink"
                    }`
                  : "font-mono tabular text-[15px] leading-none font-semibold text-ink-2 md:text-[17px]"
              }
            >
              {String(rank).padStart(2, "0")}
            </span>
            {best && (
              <span
                aria-hidden="true"
                className="absolute -bottom-[7px] left-1/2 h-[3px] w-5 -translate-x-1/2 bg-accent"
              />
            )}
          </span>
        ) : (
          <span className="font-mono text-[13px] text-ink-3">—</span>
        )}
      </div>
      {/* 主列：标签 + 模型/出处（min-width:0 + 省略） */}
      <div className={`${COL_MAIN} flex flex-col justify-center gap-[3px] py-3.5 pr-3`}>
        <div className="flex min-w-0 items-center gap-2">
          <span className={`truncate text-[13.5px] font-semibold ${dim ? "text-ink-2" : "text-ink"}`}>
            {entry.label || entry.model}
          </span>
          {best && (
            <span className="flex-none bg-accent px-1.5 py-[2px] font-mono text-[10px] font-semibold text-panel">
              本组最优
            </span>
          )}
          {demo && (
            <span className="flex-none border border-line-2 px-1.5 py-[1px] font-mono text-[10px] text-ink-2">
              示例
            </span>
          )}
          {legacy && (
            <span className="flex-none border border-dashed border-mute px-1.5 py-[1px] font-mono text-[10px] text-mute">
              遗留·不可排名
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-ink-3">
          {entry.model} · {host}
          {provenance}
        </p>
      </div>
      {/* 指标区：移动端折行横排（对齐主列起点，pl = 4px 轨 + 44px rank 列）；桌面经 md:contents 提升为固定宽右对齐三列 */}
      <div className="flex basis-full flex-wrap items-baseline gap-x-4 gap-y-1 pb-3.5 pl-[48px] md:contents">
        {METRICS.map((m) => {
          const active = metric === m.id;
          const value = metricCellText(entry, m.id);
          /* 当前排序指标列：本组最优值 = 珊瑚 700 + 2px 下划规线（印刷汇总强调线） */
          const valueCls = active
            ? best
              ? "border-b-2 border-accent font-bold text-accent"
              : "font-semibold text-ink"
            : dim
              ? "text-ink-3"
              : "text-ink-2";
          return (
            <div
              key={m.id}
              className={`${METRIC_COL[m.id]} flex flex-none items-baseline gap-1.5 self-center md:justify-end md:pr-4`}
            >
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-3 md:hidden">
                {m.short}
              </span>
              <span className={`font-mono tabular text-[13px] ${valueCls}`}>{value}</span>
            </div>
          );
        })}
        {/* transport 来源徽章（mono 描边） */}
        <div className={`${COL_TRANSPORT} flex flex-none items-center self-center md:justify-center`}>
          {entry.run ? (
            <span className="whitespace-nowrap border border-line-2 px-1.5 py-[1px] font-mono text-[10px] text-ink-2">
              {TRANSPORT_SHORT[entry.run.transport]}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-ink-3">—</span>
          )}
        </div>
      </div>
      {/* 操作：删除（mono 描边小方钮） */}
      <div className={`${COL_ACTION} flex items-center justify-center`}>
        <button
          onClick={() => onRemove(entry.id)}
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center border border-line-2 bg-panel px-2 py-1 font-mono text-[10.5px] font-semibold text-ink-3 transition-colors duration-200 hover:border-bad hover:text-bad"
          aria-label={`删除 ${entry.label || entry.model}`}
          data-testid="remove-entry"
        >
          删除
        </button>
      </div>
    </li>
  );
}
