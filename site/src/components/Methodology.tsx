// 方法学说明（FR-010 / AC-008）：指标口径、profile、transport 影响与数据保存位置。

import { BookOpen } from "lucide-react";
import { METHODOLOGY_POINTS, METHODOLOGY_TITLE } from "../content/copy";

export function Methodology() {
  return (
    <section
      data-testid="methodology"
      aria-labelledby="methodology-title"
      className="bg-surface rounded-2xl border border-app shadow-md-card p-5"
    >
      <h2
        id="methodology-title"
        className="flex items-center gap-2 text-[15px] font-semibold text-app"
      >
        <BookOpen className="w-4 h-4 text-primary" />
        {METHODOLOGY_TITLE}
      </h2>
      <ul className="mt-3 space-y-2">
        {METHODOLOGY_POINTS.map((p, i) => (
          <li key={i} className="flex gap-2 text-xs text-muted leading-relaxed">
            <span className="text-primary shrink-0 mt-0.5">·</span>
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}
