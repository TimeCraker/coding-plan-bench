import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Brain, Coins, CreditCard, Crown, Trophy, Sparkles, Info } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

type Tab = "intelligence" | "value" | "plans";

const TABS: { id: Tab; label: string; short: string; icon: React.ReactNode }[] = [
  { id: "intelligence", label: "综合智能", short: "智能", icon: <Brain className="w-3.5 h-3.5" /> },
  { id: "value", label: "性价比", short: "性价比", icon: <Coins className="w-3.5 h-3.5" /> },
  { id: "plans", label: "订阅制 / Plan", short: "订阅", icon: <CreditCard className="w-3.5 h-3.5" /> },
];

const RANK_STYLE = [
  { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", icon: <Crown className="w-4 h-4" /> },
  { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", icon: <Trophy className="w-4 h-4" /> },
  { color: "#b45309", bg: "rgba(180,83,9,0.1)", icon: <Trophy className="w-4 h-4" /> },
];

// 任意结构的榜单条目（宽松类型，适配三套数据）
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
  value: BoardData;
  plans: BoardData;
}

function TypeTag({ type }: { type?: string }) {
  if (!type) return null;
  const open = type === "开源";
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${open ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-surface border border-app text-muted"}`}
    >
      {type}
    </span>
  );
}

function MiniTag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "blue" | "purple" }) {
  const cls = {
    muted: "bg-surface border border-app text-muted",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  }[tone];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${cls}`}>{children}</span>;
}

function Row({ item, i, pct, main, sub, note }: {
  item: Item; i: number; pct: number; main: React.ReactNode; sub?: React.ReactNode; note?: string;
}) {
  const rank = i < 3 ? RANK_STYLE[i] : null;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, ease }}
      className="relative bg-surface-2 rounded-xl overflow-hidden border border-app hover:border-strong transition-colors"
    >
      <motion.div
        className="absolute left-0 top-0 bottom-0"
        style={{ background: "linear-gradient(90deg, var(--primary), transparent)", opacity: i === 0 ? 0.12 : 0.06 }}
        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease, delay: 0.1 }}
      />
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: rank?.color || "transparent" }} />
      <div className="relative p-3.5 pl-5 flex items-center gap-3">
        <div className="flex items-center justify-center w-8 shrink-0">
          {rank ? (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: rank.bg, color: rank.color }}>
              {rank.icon}
            </div>
          ) : (
            <span className="tabular text-sm font-bold text-muted">#{i + 1}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-app truncate">{item.name as string}</span>
            {item.vendor && <span className="text-[11px] text-muted">{item.vendor as string}</span>}
            <TypeTag type={item.type as string} />
            {"region" in item && (
              <MiniTag tone={item.region === "国内" ? "blue" : "purple"}>{item.region as string}</MiniTag>
            )}
            {"access" in item && <MiniTag>{item.access as string}</MiniTag>}
          </div>
          {sub && <div className="text-[11px] text-muted truncate mt-0.5">{sub}</div>}
          {note && <div className="text-[11px] text-muted/80 truncate mt-0.5">{note}</div>}
        </div>
        <div className="text-right shrink-0 min-w-[72px]">{main}</div>
      </div>
    </motion.li>
  );
}

function Skeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="bg-surface-2 rounded-xl border border-app p-3.5 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-surface border border-app" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-surface border border-app" />
              <div className="h-2.5 w-1/2 rounded bg-surface border border-app" />
            </div>
            <div className="h-6 w-12 rounded bg-surface border border-app" />
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

  // 计算 pct 与主数值（按 tab 不同逻辑）
  function renderMain(item: Item): { main: React.ReactNode; pct: number; sub?: React.ReactNode; note?: string } {
    if (tab === "intelligence") {
      const max = 60;
      const score = item.score as number;
      return {
        main: (
          <>
            <div className="tabular text-2xl font-bold leading-none" style={{ color: item.rank === 1 ? "var(--primary)" : "var(--text)" }}>
              {score}
            </div>
            <div className="text-[10px] text-muted mt-1">/100</div>
          </>
        ),
        pct: (score / max) * 100,
        sub: `${item.tier} 档`,
      };
    }
    if (tab === "value") {
      const maxCost = 2.75;
      const cost = item.cost as number;
      // 性价比指数 = 智能分 / 成本，归一化作进度条（便宜+强 → 条长）
      const vi = (item.score as number) / cost;
      const maxVi = 50 / 0.03; // DeepSeek-Flash 上限
      return {
        main: (
          <>
            <div className="tabular text-xl font-bold leading-none" style={{ color: item.rank === 1 ? "var(--cta)" : "var(--text)" }}>
              ${cost.toFixed(2)}
            </div>
            <div className="text-[10px] text-muted mt-1">智能 {item.score as number}</div>
          </>
        ),
        pct: Math.min(100, (vi / maxVi) * 100),
        note: item.note as string | undefined,
      };
    }
    // plans
    const score = item.score as number;
    return {
      main: (
        <>
          <div className="tabular text-sm font-bold leading-tight text-app">{item.plan as string}</div>
          <div className="text-[10px] text-muted mt-1">模型 {item.model as string}</div>
        </>
      ),
      pct: (score / 60) * 100,
      note: item.note as string | undefined,
    };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease }}
      className="bg-surface rounded-2xl border border-app shadow-lg-card overflow-hidden"
    >
      {/* 头部 */}
      <div className="px-5 md:px-6 py-4 border-b border-app bg-surface-2/50">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-app leading-tight">全球模型能力榜</h2>
              <p className="text-[11px] text-muted leading-tight">
                行业参考数据{data ? ` · 更新于 ${data.meta.updatedAt}` : ""}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <Info className="w-3 h-3" />
            <span>非本机实测，互补参考</span>
          </div>
        </div>

        {/* tab 切换 */}
        <div className="flex items-center justify-between flex-wrap gap-2 mt-4">
          <div className="inline-flex bg-surface-2 rounded-lg p-0.5 border border-app">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer"
                style={{ color: tab === t.id ? "#fff" : "var(--text-muted)" }}
              >
                {tab === t.id && (
                  <motion.div
                    layoutId="global-pill"
                    className="absolute inset-0 rounded-md bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative inline-flex items-center gap-1.5">
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.short}</span>
                </span>
              </button>
            ))}
          </div>
          {board && (
            <span className="text-[11px] text-muted">{board.subtitle}</span>
          )}
        </div>
      </div>

      {/* 列表 */}
      <div className="p-3 md:p-3">
        {err ? (
          <p className="text-sm text-muted text-center py-12">榜单数据加载失败</p>
        ) : !data || !board ? (
          <Skeleton />
        ) : (
          <motion.ul layout className="space-y-2">
            <AnimatePresence mode="popLayout">
              {board.items.map((item, i) => {
                const { main, pct, sub, note } = renderMain(item);
                return <Row key={`${tab}-${i}`} item={item} i={i} pct={pct} main={main} sub={sub} note={note} />;
              })}
            </AnimatePresence>
          </motion.ul>
        )}

        {/* 数据来源 */}
        {data && (
          <div className="mt-4 px-2 pb-1">
            <p className="text-[10px] text-muted/70 leading-relaxed">
              <Sparkles className="w-3 h-3 inline mr-1 -mt-0.5" />
              数据来源：{data.meta.sources.join(" · ")}。{data.meta.note}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
