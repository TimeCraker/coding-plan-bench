// 方法学说明（FR-010 / AC-008）：指标口径、profile、transport 影响与数据保存位置。
// Swiss 次级区块：发丝线外框（不用墨线粗框、无硬阴影），mono 序号 + 发丝线分隔行。

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
        <span className="whitespace-nowrap">{METHODOLOGY_TITLE}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-line-2" />
      </h2>
      <ul className="mt-3 max-w-[65ch] divide-y divide-line">
        {METHODOLOGY_POINTS.map((p, i) => (
          <li key={i} className="flex gap-3 py-2.5 first:pt-1 last:pb-0">
            <span
              aria-hidden="true"
              className="mt-[6px] flex-none font-mono text-[10px] font-semibold tabular text-ink-3"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="min-w-0 text-[13px] leading-[1.7] text-ink-2">{renderTerms(p)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
