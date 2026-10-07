import { Fragment, useEffect, useState } from "react";

type Tab = "intelligence" | "value" | "plans" | "agent";

// 榜切换：2px 墨底线 tabs（agent-hive .tab 语言）；短码 mono + 全名 sans + mono 计数
const TABS: { id: Tab; code: string; label: string; short: string }[] = [
  { id: "intelligence", code: "IQ", label: "综合智能", short: "智能" },
  { id: "agent", code: "AG", label: "Agent 能力", short: "Agent" },
  { id: "value", code: "VAL", label: "性价比", short: "性价比" },
  { id: "plans", code: "PLN", label: "订阅制 / Plan", short: "订阅" },
];

// 分数列头：单位一次进列头，行内不再逐行重复「/100」「Elo」
const UNIT_LABEL: Record<Tab, string> = {
  intelligence: "SCORE /100",
  agent: "ELO",
  value: "USD /TASK",
  plans: "PLAN",
};

// 任意结构的榜单条目（宽松类型，适配四套数据）
type Item = Record<string, unknown>;

interface BoardData {
  title: string;
  subtitle: string;
  unit?: string;
  higherBetter?: boolean;
  items: Item[];
}

interface LbData {
  meta: { updatedAt: string; sources: string[]; note: string };
  intelligence: BoardData;
  agent: BoardData;
  value: BoardData;
  plans: BoardData;
}

function TypeTag({ type }: { type?: string }) {
  if (!type) return null;
  const open = type === "开源";
  return (
    <span
      className={`font-mono text-[10px] px-1.5 py-px font-medium shrink-0 border ${open ? "border-ok text-ok" : "border-line-2 text-ink-3"}`}
    >
      {type}
    </span>
  );
}

function MiniTag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" }) {
  const cls = {
    muted: "border-line-2 text-ink-3",
    accent: "border-accent text-accent",
  }[tone];
  return <span className={`font-mono text-[10px] px-1.5 py-px shrink-0 border ${cls}`}>{children}</span>;
}

// 行内数据条（柱状图墙）：轨道发丝线，fill 按区段归一宽度——#1 珊瑚 / 其余油墨 / legacy 降档
function Bar({ pct, fillCls, cls }: { pct: number; fillCls: string; cls: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className={`bg-panel-2 border border-line ${cls}`} aria-hidden="true">
      <div className={`h-full ${fillCls}`} style={{ width: `${w}%` }} />
    </div>
  );
}

// 口径分节带：section 标记 → 分节标签（旧口径存置区显式化，不与主区混排）
const SECTION_LABELS: Record<string, string> = {
  "legacy-v41": "V4.1 存置区 · 旧口径 · 不与上列混排",
  "legacy-gdpval-v2": "GDPval v2 存置区 · 旧口径 · 不与上列混排",
};

function Row({ item, i, main, sub, note, pct, legacy }: {
  item: Item; i: number; main: React.ReactNode; sub?: React.ReactNode; note?: string; pct?: number; legacy?: boolean;
}) {
  // 排名：前三名戏剧化 mono 大数字（#1 珊瑚 + 底部 3px 珊瑚短规线，2-3 墨色加重），其余次级墨不变
  const rankCls = i === 0 ? "text-accent font-bold" : i < 3 ? "text-ink font-semibold" : "text-ink-2";
  const rankSize = i < 3 ? "text-2xl tracking-tighter" : "text-lg";
  // 数据条填充色：legacy 旧口径区降档深发丝线，#1 珊瑚，其余油墨
  const fillCls = legacy ? "bg-line-2" : i === 0 ? "bg-accent" : "bg-ink";
  // 行内标签组：sm 以下并入 sub 收纳行，name 行只留 name + vendor
  const tags = (
    <>
      <TypeTag type={item.type as string} />
      {"region" in item && (
        <MiniTag tone={item.region === "国内" ? "accent" : "muted"}>{item.region as string}</MiniTag>
      )}
      {"access" in item && <MiniTag>{item.access as string}</MiniTag>}
    </>
  );
  return (
    <li className="anim-fade-up bg-panel hover:bg-panel-2 transition-colors border-b border-line last:border-b-0">
      <div className="flex items-center gap-3 px-3.5 md:px-4 py-3">
        <div className="flex items-center justify-end basis-[44px] shrink-0">
          <span className={`relative tabular font-mono leading-none ${rankSize} ${rankCls}`}>
            {String(i + 1).padStart(2, "0")}
            {i === 0 && (
              <span className="absolute -bottom-[5px] right-0 w-5 h-[3px] bg-accent" aria-hidden="true" />
            )}
          </span>
        </div>
        <div className="flex-1 basis-[240px] min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
            <span className={`font-semibold text-[13.5px] truncate ${legacy ? "text-ink-2" : "text-app"}`}>
              {item.name as string}
            </span>
            {typeof item.vendor === "string" && item.vendor && (
              <span className="font-mono text-[11px] text-ink-3 truncate">{item.vendor}</span>
            )}
            <span className="hidden sm:contents">{tags}</span>
          </div>
          {sub && <div className="hidden sm:block font-mono text-[11px] text-ink-3 truncate mt-0.5">{sub}</div>}
          <div className="flex sm:hidden items-center gap-1 flex-wrap mt-1">
            {tags}
            {sub && <span className="font-mono text-[11px] text-ink-3">{sub}</span>}
          </div>
          {typeof pct === "number" && <Bar pct={pct} fillCls={fillCls} cls="sm:hidden w-full h-[6px] mt-1.5" />}
          {note && <div className="text-[11px] text-ink-3 truncate mt-0.5">{note}</div>}
        </div>
        {typeof pct === "number" && (
          <div className="hidden sm:block flex-1 min-w-0">
            <Bar pct={pct} fillCls={fillCls} cls="w-full h-[8px]" />
          </div>
        )}
        <div className="text-right shrink-0 basis-[84px] md:basis-[112px]">{main}</div>
      </div>
    </li>
  );
}

function Skeleton() {
  return (
    <ul>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="bg-panel border-b border-line last:border-b-0 px-3.5 md:px-4 py-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-7 h-6 bg-panel-2 border border-line" />
            <div className="flex-1 basis-[240px] min-w-0 space-y-1.5">
              <div className="h-3 w-1/3 bg-panel-2 border border-line" />
              <div className="h-2.5 w-1/2 bg-panel-2 border border-line" />
            </div>
            <div className="hidden sm:block flex-1 h-[8px] bg-panel-2 border border-line" />
            <div className="h-8 w-16 bg-panel-2 border border-line" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function GlobalLeaderboard() {
  const [tab, setTab] = useState<Tab>("intelligence");
  const [data, setData] = useState<LbData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}leaderboards.json`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  const board = data ? data[tab] : null;

  // 区段归一基准：section 标记切换处重置，区内取最大 score——legacy 旧口径独立归一，不与主区混标
  const segMax: number[] = [];
  if (board) {
    let curSec: unknown;
    let curMax = 0;
    for (const it of board.items) {
      if (it.section !== curSec) { curSec = it.section; curMax = 0; }
      if (typeof it.score === "number" && it.score > curMax) curMax = it.score;
      segMax.push(curMax);
    }
  }

  // 主数值列（按 tab 不同逻辑；数据口径与原实现一致；单位已上移列头）
  function renderMain(item: Item): { main: React.ReactNode; sub?: React.ReactNode; note?: string } {
    // 英雄尺度：#1 行 md 40px 珊瑚，其余 md 32px；移动端统一 24px
    const sizeCls = item.rank === 1 ? "text-2xl md:text-[40px]" : "text-2xl md:text-[32px]";
    const toneCls = item.rank === 1 ? "text-accent" : "text-ink";
    if (tab === "intelligence") {
      const score = item.score as number;
      return {
        main: <div className={`tabular font-mono font-bold leading-none ${sizeCls} ${toneCls}`}>{score}</div>,
        sub: `${item.tier} 档`,
      };
    }
    if (tab === "agent") {
      // GDPval-AA v2 Elo，分数存 score 字段
      const elo = item.score as number;
      return {
        main: <div className={`tabular font-mono font-bold leading-none ${sizeCls} ${toneCls}`}>{elo}</div>,
        note: item.note as string | undefined,
      };
    }
    if (tab === "value") {
      const cost = item.cost as number;
      return {
        main: (
          <>
            <div className={`tabular font-mono font-bold leading-none ${sizeCls} ${toneCls}`}>${cost.toFixed(2)}</div>
            <div className="font-mono text-[10px] text-ink-3 mt-1">智能 {item.score as number}</div>
          </>
        ),
        note: item.note as string | undefined,
      };
    }
    // plans
    return {
      main: (
        <>
          <div className="font-mono text-[13px] font-bold leading-tight text-ink">{item.plan as string}</div>
          <div className="font-mono text-[10px] text-ink-3 mt-1">{item.model as string}</div>
        </>
      ),
      note: item.note as string | undefined,
    };
  }

  return (
    <div className="anim-fade-up bg-panel border-[1.5px] border-ink hard-shadow">
      {/* 头带：珊瑚方标 + 标题 + 版戳（更新于 · REV 描边章）+ 来源说明 */}
      <div className="bg-panel-2 border-b border-line px-4 md:px-5 py-3.5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-4 h-4 bg-accent relative shrink-0" aria-hidden="true">
              <div className="absolute inset-[3px] bg-paper" />
            </div>
            <div className="min-w-0">
              <h2 className="font-disp text-[15px] font-bold text-ink leading-tight tracking-tight">全球模型能力榜</h2>
              <p className="font-mono text-[11px] text-ink-3 leading-tight mt-1 flex items-center gap-1.5 min-w-0">
                {data ? (
                  <>
                    <span className="shrink-0">更新于</span>
                    <span className="border border-line-2 px-1.5 py-px text-[10px] tracking-[0.08em] text-ink-2 whitespace-nowrap">
                      <span className="font-bold text-ink">REV</span> · {data.meta.updatedAt}
                    </span>
                  </>
                ) : (
                  "CPB · GLOBAL"
                )}
              </p>
            </div>
          </div>
          <span className="lbl-mono shrink-0">非本机实测 · 互补参考</span>
        </div>
      </div>

      {/* 榜切换 tabs：2px 墨底线，选中珊瑚底线压墨线；选中态短码转珊瑚 */}
      <div className="px-4 md:px-5 mt-3 -mb-px">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div role="tablist" aria-label="榜单切换" className="flex gap-2 overflow-x-auto w-max min-w-full">
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${on ? "text-ink" : "text-ink-2 hover:text-ink"}`}
                >
                  <span className={`font-mono text-[10px] font-bold tracking-[0.08em] ${on ? "text-accent" : "text-ink-3"}`}>
                    {t.code}
                  </span>
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.short}</span>
                  {data && <span className="font-mono text-[10px] text-ink-3">· {data[t.id].items.length}</span>}
                  {on && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {board && (
            <span className="font-mono text-[11px] text-ink-3 pb-2 min-w-0 max-w-full">{board.subtitle}</span>
          )}
        </div>
        <div className="h-[2px] bg-ink" aria-hidden="true" />
      </div>

      {/* 列表 */}
      <div>
        {err ? (
          <div className="py-12 border-t border-line text-center">
            <p className="lbl-mono">FETCH FAILED</p>
            <p className="text-sm text-ink-3 mt-2">榜单数据加载失败</p>
          </div>
        ) : !data || !board ? (
          <Skeleton />
        ) : (
          <>
            {/* 列头：与行四段同构（# / MODEL / 数据条腔 / 分数单位） */}
            <div className="flex items-center gap-3 px-3.5 md:px-4 py-1.5 bg-panel-2 border-b border-line">
              <div className="basis-[44px] shrink-0 text-right"><span className="lbl-mono">#</span></div>
              <div className="flex-1 basis-[240px] min-w-0"><span className="lbl-mono">MODEL</span></div>
              <div className="hidden sm:block flex-1 min-w-0" aria-hidden="true" />
              <div className="text-right shrink-0 basis-[84px] md:basis-[112px]">
                <span className="lbl-mono">{UNIT_LABEL[tab]}</span>
              </div>
            </div>
            <ul>
              {board.items.map((item, i) => {
                const { main, sub, note } = renderMain(item);
                // 口径区段起始处插分节带：上下 2px 墨线，口径切换显式化
                const secLabel = item.section ? SECTION_LABELS[item.section as string] : undefined;
                const legacy = Boolean(secLabel);
                const secStart = legacy && board.items[i - 1]?.section !== item.section;
                const pct = typeof item.score === "number" && segMax[i] > 0
                  ? (item.score / segMax[i]) * 100
                  : undefined;
                return (
                  <Fragment key={`${tab}-${i}`}>
                    {secStart && secLabel && (
                      <li className="bg-paper border-y-2 border-ink px-3.5 md:px-4 py-1.5">
                        <span className="lbl-mono">{secLabel}</span>
                      </li>
                    )}
                    <Row item={item} i={i} main={main} sub={sub} note={note} pct={pct} legacy={legacy} />
                  </Fragment>
                );
              })}
            </ul>
          </>
        )}

        {/* 数据来源 */}
        {data && (
          <div className="mt-0 px-4 md:px-5 py-3 border-t border-line">
            <p className="font-mono text-[10px] text-ink-3 leading-relaxed flex gap-1.5 min-w-0">
              <span className="border border-line-2 px-1 shrink-0 self-start">SRC</span>
              <span className="min-w-0">数据来源：{data.meta.sources.join(" · ")}。{data.meta.note}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
