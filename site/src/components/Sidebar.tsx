// 应用壳页首（Swiss Industrial Print，对齐 agent-hive 面板骨架）：
// masthead 品牌行 + sticky 导航 tabs，桌面/移动统一为同一顶部结构
// （原「玻璃侧边栏 + 移动端双导航」与主题切换已随壳层重构移除）。

export type View = "bench" | "global";

// tab 前几何方点 / 选中底线同色：测速台 = run 蓝（实测进行语义）、能力榜 = accent 珊瑚
const NAV: { id: View; label: string; dot: string }[] = [
  { id: "bench", label: "测速台", dot: "bg-run" },
  { id: "global", label: "能力榜", dot: "bg-accent" },
];

interface Props {
  view: View;
  onView: (v: View) => void;
}

export function Masthead({ view, onView }: Props) {
  return (
    <>
      {/* masthead：几何 mark + 字标堆叠 + 右侧 meta 徽章列 */}
      <header className="mx-auto w-full max-w-[1240px] px-4 pt-6 md:px-9 md:pt-8">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
          {/* 几何 mark：16px 珊瑚方块 + 3px 纸色 inset（agent-hive .mark 同构） */}
          <span className="relative h-4 w-4 shrink-0 bg-accent" aria-hidden="true">
            <span className="absolute inset-[3px] bg-paper" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-disp text-[18px] font-bold leading-none tracking-[-0.03em] text-ink whitespace-nowrap md:text-[22px]">
              Coding Plan Bench
            </span>
            <span className="font-mono text-[10.5px] leading-none tracking-[0.14em] text-ink-3 whitespace-nowrap">
              CPB · 可信测速台
            </span>
          </div>
          {/* meta 徽章列：profile 事实 + GitHub 源码（描边 mono 小徽章） */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="border border-line-2 bg-panel px-3 py-[5px] font-mono text-[11px] whitespace-nowrap text-ink-2">
              profile · cpb-standard@1
            </span>
            <a
              href="https://github.com/TimeCraker/coding-plan-bench"
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer border border-line-2 bg-panel px-3 py-[5px] font-mono text-[11px] whitespace-nowrap text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* sticky 导航：纸底不透明（遮滚动内容）+ 2px 墨底线 + 状态色方点 tabs */}
      <nav className="sticky top-0 z-[100] mt-5 border-b-2 border-ink bg-paper">
        <div className="mx-auto flex w-full max-w-[1240px] overflow-x-auto px-4 md:px-9">
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => onView(n.id)}
                data-active={active}
                className={`relative inline-flex cursor-pointer items-center gap-2.5 px-5 py-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
                  active ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                <span className={`st-dot ${n.dot}`} aria-hidden="true" />
                {n.label}
                {/* 选中底线：2px 色条压在导航墨线上（inset 定位，不依赖负 margin，横向滚动安全） */}
                {active && (
                  <span className={`absolute inset-x-0 bottom-0 h-0.5 ${n.dot}`} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
