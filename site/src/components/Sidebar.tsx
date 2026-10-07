// 应用壳页首（Swiss Industrial Print，对齐 agent-hive 面板骨架）：
// masthead 品牌行（版心顶规线 + 版号戳）+ sticky segmented 导航，桌面/移动统一为同一顶部结构
// （原「玻璃侧边栏 + 移动端双导航」与主题切换已随壳层重构移除）。

export type View = "bench" | "global";

// tab 前几何方点保留 per-tab 语义色（测速台 = run 蓝实测语义、能力榜 = accent 珊瑚）；
// 选中格内方点统一转珊瑚——「选中」是全局语义（墨底上原蓝点不可辨，EYE P0 同源）
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
      {/* masthead：版心顶规线（印刷版面顶线）+ 几何 mark + 字标堆叠 + 右侧版号戳列 */}
      <header className="mx-auto w-full max-w-[1240px] border-t-2 border-ink px-4 pt-5 md:px-9 md:pt-6">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
          {/* 几何 mark：16px 珊瑚方块 + 3px 纸色 inset（agent-hive .mark 同构） */}
          <span className="relative h-4 w-4 shrink-0 bg-accent" aria-hidden="true">
            <span className="absolute inset-[3px] bg-paper" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-disp text-[18px] font-bold leading-none tracking-[-0.03em] text-ink whitespace-nowrap md:text-[22px]">
              Coding Plan Bench
            </span>
            <span className="font-mono text-[10.5px] leading-none tracking-[0.12em] text-ink-3 whitespace-nowrap">
              CPB · 可信测速台 · EST. 2026
            </span>
          </div>
          {/* 版号戳列：固定版次记号 + GitHub 源码（描边 mono 小徽章，折叠不丢） */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="border border-line-2 bg-panel px-3 py-[5px] font-mono text-[11px] whitespace-nowrap text-ink-2">
              EDITION · 2026-10
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

      {/* sticky 导航：纸底不透明（遮滚动内容）+ 方框 segmented 分格——
          墨线外框自带结构线，nav 不再另设 2px 底线（页面更简）；
          选中格墨底纸字（方点转珊瑚 = 选中语义），未选格发丝分隔 + hover 二级面板底；
          移动端两格等宽撑满（全局 44px 触达兜底），桌面内容自适应收缩 */}
      <nav className="sticky top-0 z-[100] mt-5 bg-paper">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-3 md:px-9">
          <div className="inline-flex w-full border-[1.5px] border-ink md:w-auto">
            {NAV.map((n, i) => {
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onView(n.id)}
                  data-active={active}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2.5 px-5 py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors md:flex-none ${
                    i > 0 ? "border-l border-line-2" : ""
                  } ${
                    active
                      ? "bg-ink text-paper"
                      : "bg-paper text-ink-2 hover:bg-panel-2 hover:text-ink"
                  }`}
                >
                  <span className={`st-dot ${active ? "bg-accent" : n.dot}`} aria-hidden="true" />
                  {n.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
