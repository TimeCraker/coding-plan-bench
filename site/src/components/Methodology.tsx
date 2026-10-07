// 方法学说明（FR-010 / AC-008）：指标口径、profile、transport 影响与数据保存位置。
// Swiss 次级区块：发丝线外框（不用墨线粗框、无硬阴影），04 编号制标题 + 发丝线分隔行。
// 印刷词汇表制式：左列 mono 术语 + 右列释义；桌面双栏（EYE P1-7），65ch 行宽限制移至列内。

import type { ReactNode } from "react";
import { METHODOLOGY_POINTS, METHODOLOGY_TITLE } from "../content/copy";

/** 词汇表左列术语码（展示层映射，不改文案源；顺序与 METHODOLOGY_POINTS 一一对应） */
const TERMS = ["PROFILE", "TTFT", "TPS", "TOTAL", "STORAGE"];

/** 术语条目右列剥离开头「TTFT =」式前缀（左列已示术语，避免重复） */
function stripTerm(text: string): string {
  return text.replace(/^(TTFT|TPS|Total)\s*=\s*/, "");
}

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
      <ul className="mt-3 divide-y divide-line md:columns-2 md:gap-8">
        {METHODOLOGY_POINTS.map((p, i) => (
          <li key={i} className="flex gap-4 break-inside-avoid py-2.5 first:pt-1 last:pb-0">
            <span className="mt-[3px] w-[64px] flex-none font-mono text-[11px] font-semibold tracking-[0.08em] text-ink">
              {TERMS[i] ?? String(i + 1).padStart(2, "0")}
            </span>
            <p className="min-w-0 max-w-[65ch] flex-1 text-[13px] leading-[1.7] text-ink-2">
              {renderTerms(stripTerm(p))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
