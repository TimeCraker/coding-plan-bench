// 方法学说明（FR-010 / AC-008）：指标口径、profile、transport 影响与数据保存位置。
// Swiss 次级区块：发丝线外框（无墨线粗框、无硬阴影），04 编号制标题 + 小方格 grid
// （单列 → sm 双列 → lg 三列；copy.ts 五条文案 + 末位附录链接格凑齐 3×2，EYE2 P2-11；
//  正文文案全部来自 copy.ts 单一事实源，此处只做渲染）。

import type { ReactNode } from "react";
import { METHODOLOGY_POINTS, METHODOLOGY_TITLE } from "../content/copy";

/** 指标术语（TTFT / TPS / Total）在正文中以 mono 墨色强调——只改渲染，不改文案源 */
function renderTerms(text: string): ReactNode[] {
  return text.split(/(TTFT|TPS|Total)/g).map((seg, i) =>
    seg === "TTFT" || seg === "TPS" || seg === "Total" ? (
      <code key={i} className="font-mono text-[12px] font-semibold text-ink">
        {seg}
      </code>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
}

export function Methodology() {
  return (
    <section
      data-testid="methodology"
      aria-labelledby="methodology-title"
      className="border border-line-2 bg-panel px-5 py-4"
    >
      <h2 id="methodology-title" className="lbl-mono flex items-center gap-3">
        <span className="whitespace-nowrap">
          <span className="text-accent">04</span> · METHODOLOGY · {METHODOLOGY_TITLE}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-line-2" />
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {METHODOLOGY_POINTS.map((p, i) => (
          <li key={i} className="flex min-w-0 flex-col gap-1.5 border border-line bg-panel p-3">
            <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="min-w-0 text-[12.5px] leading-relaxed text-ink-2">{renderTerms(p)}</p>
          </li>
        ))}
        {/* 附录链接格：序号随 copy.ts 点数自动续排（现为 06） */}
        <li className="flex min-w-0 flex-col gap-1.5 border border-line bg-panel p-3">
          <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-accent">
            {String(METHODOLOGY_POINTS.length + 1).padStart(2, "0")}
          </span>
          <a
            href="https://github.com/TimeCraker/coding-plan-bench"
            target="_blank"
            rel="noreferrer"
            className="min-w-0 text-[12.5px] font-medium leading-relaxed text-ink underline decoration-line-2 underline-offset-4 transition-colors duration-200 hover:text-accent hover:decoration-accent"
          >
            口径详情 → README
          </a>
        </li>
      </ul>
    </section>
  );
}
