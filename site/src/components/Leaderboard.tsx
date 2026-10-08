// 可比较榜单（FR-008 / AC-006 / AUD-007 根治）：
// - 三个互不混排的分区：可比排名（comparability key 分组）/ 示例（demo）/ 遗留（legacy，不可排名）
// - 只有兼容 complete 参与对应 metric 排名；TPS 排名额外要求 provider usage
// - 删除：立即生效 + aria-live 恢复（不自动消失）；清空：稳定确认对话（非 3 秒文字切换）
// - Swiss Industrial Print：行式列表 + 左侧 4px 状态色轨 + 固定列基准宽（列对齐铁律：
//   每列固定 flex-basis + min-width:0 + 内容省略，宽度由基准决定、与内容无关）
// - 成绩公报制式：前三名 rank 大数字（#1 珊瑚 + 底部短规线）、本组最优值珊瑚下划规线、
//   列内单位恒定（TTFT 恒 ms / Total 恒 s，EYE P2-1）

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { buildBoardMarkdown, copyText } from "../lib/boardShare";
import {
  BOARD_SHARE,
  BOARD_SHARE_DONE,
  BOARD_VIEW_LIST,
  BOARD_VIEW_TREND,
} from "../content/copy";
import { TrendSpark } from "./TrendSpark";

type Metric = RankableMetric;

/** 视图切换（wave22）：榜单 / 趋势——纯前端视图状态，不写 storage */
type ViewKind = "list" | "trend";
const VIEWS: { id: ViewKind; text: string }[] = [
  { id: "list", text: BOARD_VIEW_LIST },
  { id: "trend", text: BOARD_VIEW_TREND },
];

const METRICS: {
  id: Metric;
  label: string;
  short: string;
  lowerBetter: boolean;
}[] = [
  { id: "ttft", label: "首 token 延迟", short: "TTFT", lowerBetter: true },
  { id: "tps", label: "输出速度", short: "TPS", lowerBetter: false },
  { id: "total", label: "总耗时", short: "Total", lowerBetter: true },
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
  const [view, setView] = useState<ViewKind>("list");
  const [confirmClear, setConfirmClear] = useState(false);
  const [undoable, setUndoable] = useState<LeaderboardEntryV2 | null>(null);
  const [shareDone, setShareDone] = useState(false);
  const shareTimer = useRef<number | null>(null);
  const cfg = METRICS.find((m) => m.id === metric)!;

  /* 复制反馈计时器：卸载时清理，避免卸载后 setState */
  useEffect(
    () => () => {
      if (shareTimer.current !== null) window.clearTimeout(shareTimer.current);
    },
    [],
  );

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

  /* 复制榜单：当前可比条目 + 当前排序指标 → markdown；成功后 2.5s 反馈 */
  const handleShare = async () => {
    const ok = await copyText(buildBoardMarkdown(entries, metric));
    if (!ok) return;
    setShareDone(true);
    if (shareTimer.current !== null) window.clearTimeout(shareTimer.current);
    shareTimer.current = window.setTimeout(() => setShareDone(false), 2500);
  };

  const groupKeys = new Set(
    rankable.map((e) => comparabilityKey(e)).filter((k): k is string => k !== null),
  );

  return (
    <section
      className="anim-fade-up bg-panel border-[1.5px] border-ink hard-shadow"
      data-testid="leaderboard"
    >
      {/* 头部（EYE2 P1-2 五层压两层）：编号制标题 + 计数并入标题行右段（清空钮左侧，
          原独立计数行删除）；排序方向并入 active tab 后缀（原独立排序说明行删除） */}
      <header className="px-4 pt-4 md:px-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="lbl-mono flex min-w-0 flex-1 items-center gap-3">
          <span className="whitespace-nowrap">
            <span className="text-accent">03</span> · LEADERBOARD · 本机榜单
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-line-2" />
        </h2>
        {/* 视图切换 segmented（榜单/趋势）：墨线外框 + 格间发丝分隔 + 选中格墨底反白 */}
        <div className="flex border-[1.5px] border-ink" role="group" aria-label="榜单视图">
          {VIEWS.map((v) => {
            const on = view === v.id;
            return (
              <button
                key={v.id}
                aria-pressed={on}
                onClick={() => setView(v.id)}
                className={`flex-none border-l border-line px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wide first:border-l-0 cursor-pointer transition-colors duration-200 ${
                  on ? "bg-ink text-paper" : "bg-panel text-ink-2 hover:bg-panel-2 hover:text-ink"
                }`}
              >
                {v.text}
              </button>
            );
          })}
        </div>
        {/* 计数制式：每段 = 数值（600 墨）+ 标签（ink-3），段间 mono 中点分隔 */}
        <p className="whitespace-nowrap font-mono text-[11px] tabular tracking-[0.02em] text-ink-3">
          可比 <span className="font-semibold text-ink">{rankable.length}</span> 条 · 示例{" "}
          <span className="font-semibold text-ink">{demos.length}</span> 条 · 遗留{" "}
          <span className="font-semibold text-ink">{legacy.length}</span> 条
          {groupKeys.size > 1 && (
            <>
              {" · "}
              <span className="font-semibold text-ink">{groupKeys.size}</span> 组
            </>
          )}
        </p>
        {/* 复制榜单（wave22）：当前可比条目 → markdown 入剪贴板；成功反馈 role=status 2.5s */}
        {rankable.length > 0 && (
          <span className="flex items-center gap-2">
            {shareDone && (
              <span role="status" data-testid="share-done" className="font-mono text-[11px] text-ok">
                {BOARD_SHARE_DONE}
              </span>
            )}
            <button onClick={handleShare} className={BTN_NEUTRAL} data-testid="share-board">
              {BOARD_SHARE}
            </button>
          </span>
        )}
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

      {/* 排序指标 segmented：1.5px 墨线外框 + 格间发丝分隔，选中格墨底反白（与 nav 方框语言一致）；
          排序方向（↓ 越低 / ↑ 越高）并入 active tab 后缀，箭头 aria-hidden 不改可访问名。
          趋势视图只看 TTFT 历史，排序指标仅属于榜单视图 */}
      {view === "list" && (
      <div className="mt-3 overflow-x-auto px-4 md:px-5">
        <div className="flex w-max border-[1.5px] border-ink" role="tablist" aria-label="排序指标">
          {METRICS.map((m) => {
            const on = metric === m.id;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={on}
                onClick={() => setMetric(m.id)}
                className={`flex flex-none items-baseline gap-2 whitespace-nowrap border-l border-line px-4 py-2.5 first:border-l-0 cursor-pointer transition-colors duration-200 ${
                  on
                    ? "bg-ink text-paper"
                    : "bg-panel text-ink-2 hover:bg-panel-2 hover:text-ink"
                }`}
              >
                <span className="font-mono text-[11px] font-bold tracking-wide">{m.short}</span>
                <span className="hidden text-[13px] font-medium sm:inline">{m.label}</span>
                {on && (
                  <span
                    aria-hidden="true"
                    className="font-mono text-[11px] font-bold tracking-wide text-accent-lift"
                  >
                    {m.lowerBetter ? "↓" : "↑"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      )}

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

      {/* 主体视图切换（wave22）：榜单 = 三分区行式列表 / 趋势 = TrendSpark 火花线速览 */}
      {view === "list" ? (
      <div className="px-4 pb-4 pt-1 md:px-5">
        <SectionLabel>可比排名 · 同条件才比</SectionLabel>
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

        {/* 分区二：示例数据（独立，不参与上方排名）；列头与可比区共用（EYE2 P2-7） */}
        {demos.length > 0 && (
          <>
            <SectionLabel>示例 · 不参与排名</SectionLabel>
            <ul className="border border-line-2">
              <ColumnHeader metric={metric} />
              {demos.map((e) => (
                <Row key={e.id} entry={e} metric={metric} demo onRemove={handleRemove} />
              ))}
            </ul>
          </>
        )}

        {/* 分区三：遗留数据（v1 迁移，不可排名）；列头同上复用 */}
        {legacy.length > 0 && (
          <>
            <SectionLabel>旧版记录 · 不可比</SectionLabel>
            <ul className="border border-line-2">
              <ColumnHeader metric={metric} />
              {legacy.map((e) => (
                <Row key={e.id} entry={e} metric={metric} legacy onRemove={handleRemove} />
              ))}
            </ul>
          </>
        )}
      </div>
      ) : (
        <TrendSpark entries={entries} />
      )}
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
      {/* 主列：标签 + 模型/profile 档位（min-width:0 + 省略；host 与主列信息重复，已减） */}
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
          {/* transport 来源徽章（EYE2 P2-8：上提进名称行与「示例」徽章同排，
              行尾折行只留删除钮；legacy 无 run 信息不显示） */}
          {entry.run && (
            <span className="flex-none whitespace-nowrap border border-line-2 px-1.5 py-[1px] font-mono text-[10px] text-ink-2">
              {TRANSPORT_SHORT[entry.run.transport]}
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-ink-3">
          {entry.model}
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
