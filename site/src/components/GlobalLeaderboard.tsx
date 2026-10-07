import { useEffect, useState } from "react";

type Tab = "intelligence" | "value" | "plans" | "agent";

// 榜切换：2px 墨底线 tabs（agent-hive .tab 语言）；短码 mono + 全名 sans
const TABS: { id: Tab; code: string; label: string; short: string }[] = [
  { id: "intelligence", code: "IQ", label: "综合智能", short: "智能" },
  { id: "agent", code: "AG", label: "Agent 能力", short: "Agent" },
  { id: "value", code: "VAL", label: "性价比", short: "性价比" },
  { id: "plans", code: "PLN", label: "订阅制 / Plan", short: "订阅" },
];

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

function Row({ item, i, main, sub, note }: {
  item: Item; i: number; main: React.ReactNode; sub?: React.ReactNode; note?: string;
}) {
  // 排名：mono 大数字；#1 珊瑚（唯一强调），2-3 墨色加重，其余次级墨
  const rankCls = i === 0 ? "text-accent font-bold" : i < 3 ? "text-ink font-semibold" : "text-ink-2";
  return (
    <li className="anim-fade-up bg-panel hover:bg-panel-2 transition-colors border-b border-line last:border-b-0">
      <div className="flex items-center gap-3 px-3.5 md:px-4 py-3">
        <div className="flex items-center justify-end basis-[44px] shrink-0">
          <span className={`tabular font-mono text-lg leading-none ${rankCls}`}>
            {String(i + 1).padStart(2, "0")}
          </span>
        </div>
        <div className="flex-1 basis-[240px] min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-app text-[13.5px] truncate">{item.name as string}</span>
            {typeof item.vendor === "string" && item.vendor && (
              <span className="font-mono text-[11px] text-ink-3 truncate">{item.vendor}</span>
            )}
            <TypeTag type={item.type as string} />
            {"region" in item && (
              <MiniTag tone={item.region === "国内" ? "accent" : "muted"}>{item.region as string}</MiniTag>
            )}
            {"access" in item && <MiniTag>{item.access as string}</MiniTag>}
          </div>
          {sub && <div className="font-mono text-[11px] text-ink-3 truncate mt-0.5">{sub}</div>}
          {note && <div className="text-[11px] text-ink-3 truncate mt-0.5">{note}</div>}
        </div>
        <div className="text-right shrink-0 basis-[92px]">{main}</div>
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
            <div className="w-7 h-5 bg-panel-2 border border-line" />
            <div className="flex-1 basis-[240px] min-w-0 space-y-1.5">
              <div className="h-3 w-1/3 bg-panel-2 border border-line" />
              <div className="h-2.5 w-1/2 bg-panel-2 border border-line" />
            </div>
            <div className="h-6 w-14 bg-panel-2 border border-line" />
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

  // 主数值列（按 tab 不同逻辑；数据口径与原实现一致）
  function renderMain(item: Item): { main: React.ReactNode; sub?: React.ReactNode; note?: string } {
    if (tab === "intelligence") {
      const score = item.score as number;
      return {
        main: (
          <>
            <div className={`tabular font-mono text-xl font-bold leading-none ${item.rank === 1 ? "text-accent" : "text-ink"}`}>
              {score}
            </div>
            <div className="font-mono text-[10px] text-ink-3 mt-1">/100</div>
          </>
        ),
        sub: `${item.tier} 档`,
      };
    }
    if (tab === "agent") {
      // GDPval-AA v2 Elo，分数存 score 字段
      const elo = item.score as number;
      return {
        main: (
          <>
            <div className={`tabular font-mono text-lg font-bold leading-none ${item.rank === 1 ? "text-accent" : "text-ink"}`}>
              {elo}
            </div>
            <div className="font-mono text-[10px] text-ink-3 mt-1">Elo</div>
          </>
        ),
        note: item.note as string | undefined,
      };
    }
    if (tab === "value") {
      const cost = item.cost as number;
      return {
        main: (
          <>
            <div className={`tabular font-mono text-lg font-bold leading-none ${item.rank === 1 ? "text-accent" : "text-ink"}`}>
              ${cost.toFixed(2)}
            </div>
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
      {/* 头部：珊瑚方标 + 标题 + 更新于徽章 + 来源说明 */}
      <div className="px-4 md:px-5 pt-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-4 h-4 bg-accent relative shrink-0" aria-hidden="true">
              <div className="absolute inset-[3px] bg-paper" />
            </div>
            <div className="min-w-0">
              <h2 className="font-disp text-[15px] font-bold text-ink leading-tight tracking-tight">全球模型能力榜</h2>
              <p className="font-mono text-[11px] text-ink-3 leading-tight mt-0.5">
                {data ? `更新于 ${data.meta.updatedAt}` : "CPB · GLOBAL"}
              </p>
            </div>
          </div>
          <span className="lbl-mono shrink-0">非本机实测 · 互补参考</span>
        </div>
      </div>

      {/* 榜切换 tabs：2px 墨底线，选中珊瑚底线压墨线 */}
      <div className="px-4 md:px-5 mt-3 -mb-px">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div role="tablist" aria-label="榜单切换" className="flex gap-1 overflow-x-auto w-max min-w-full">
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
                  <span className="font-mono text-[10px] font-bold tracking-[0.08em]">{t.code}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.short}</span>
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
          <p className="text-sm text-ink-3 text-center py-12 border-t border-line">榜单数据加载失败</p>
        ) : !data || !board ? (
          <Skeleton />
        ) : (
          <ul className="border-t border-line">
            {board.items.map((item, i) => {
              const { main, sub, note } = renderMain(item);
              return <Row key={`${tab}-${i}`} item={item} i={i} main={main} sub={sub} note={note} />;
            })}
          </ul>
        )}

        {/* 数据来源 */}
        {data && (
          <div className="mt-0 px-4 md:px-5 py-3 border-t border-line">
            <p className="font-mono text-[10px] text-ink-3 leading-relaxed">
              数据来源：{data.meta.sources.join(" · ")}。{data.meta.note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
