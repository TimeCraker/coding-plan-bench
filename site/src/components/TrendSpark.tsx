// 趋势速览（wave22）：同一模型多次测量的 TTFT 火花线速览。
// - 按 label（trim + 大小写不敏感）归一组；只看 status=complete；组内 ranAt 升序（左旧右新）
// - ≥2 条成组才显示；TTFT 下行（变快）= ok 绿 / 上行（变慢）= bad 红（语义色），
//   涨跌箭头 + 百分比是非颜色冗余通道，不依赖颜色可读
// - 纯手写 SVG polyline（stroke/fill=currentColor），零图表库；缺 ttft 数据的点位不伪装（跳过）

import type { LeaderboardEntryV2 } from "../../../engine/types";
import { TREND_EMPTY, TREND_SAMPLES, TREND_TITLE } from "../content/copy";

const W = 120;
const H = 20;
const PAD_Y = 2;

interface TrendGroup {
  key: string;
  label: string;
  points: { ranAt: string; ttft: number }[];
}

/** 归一分组：label trim + 大小写不敏感；过滤 status ≠ complete 与缺 ttft 的条目 */
function buildGroups(entries: readonly LeaderboardEntryV2[]): TrendGroup[] {
  const map = new Map<string, TrendGroup>();
  for (const e of entries) {
    if (e.run?.status !== "complete") continue;
    const ttft = e.run.aggregate.ttftMs;
    if (ttft == null) continue;
    const name = (e.label || e.model).trim();
    const key = name.toLowerCase();
    const g = map.get(key) ?? { key, label: name, points: [] };
    g.points.push({ ranAt: e.ranAt, ttft });
    map.set(key, g);
  }
  const groups = [...map.values()].filter((g) => g.points.length >= 2);
  for (const g of groups) {
    g.points.sort((a, b) => (a.ranAt < b.ranAt ? -1 : a.ranAt > b.ranAt ? 1 : 0));
  }
  // 组间：最近测过的在前（按组内最新 ranAt 降序）
  groups.sort((a, b) => {
    const la = a.points[a.points.length - 1].ranAt;
    const lb = b.points[b.points.length - 1].ranAt;
    return la < lb ? 1 : la > lb ? -1 : 0;
  });
  return groups;
}

/** 首末比较：TTFT 变快 = down（ok）/ 变慢 = up（bad）/ 持平 = flat */
function deltaOf(values: number[]): { dir: "down" | "up" | "flat"; pct: number } {
  const first = values[0];
  const last = values[values.length - 1];
  if (first <= 0) return { dir: last === first ? "flat" : "up", pct: 0 };
  const pct = Math.round(((last - first) / first) * 100);
  if (pct === 0) return { dir: "flat", pct: 0 };
  return pct < 0 ? { dir: "down", pct: -pct } : { dir: "up", pct };
}

/** TTFT 归一化映射到 120×20 画布（上下留 2px；值域退化时居中水平线） */
function sparkCoords(values: number[]): { x: number; y: number }[] {
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return values.map((v, i) => {
    const norm = range === 0 ? 0.5 : (v - min) / range;
    const x = n <= 1 ? W / 2 : (i / (n - 1)) * W;
    const y = PAD_Y + (1 - norm) * (H - 2 * PAD_Y);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });
}

const TONE: Record<"down" | "up" | "flat", string> = {
  down: "text-ok",
  up: "text-bad",
  flat: "text-ink-3",
};

function Sparkline({ label, values, tone }: { label: string; values: number[]; tone: string }) {
  const coords = sparkCoords(values);
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${label} · TTFT 趋势 ${values.length} 次`}
      className={`flex-none overflow-visible ${tone}`}
    >
      <polyline
        points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((c, i) => (
        <circle
          key={`${c.x}-${c.y}`}
          cx={c.x}
          cy={c.y}
          r={i === coords.length - 1 ? 2.5 : 1.5}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export function TrendSpark({ entries }: { entries: LeaderboardEntryV2[] }) {
  const groups = buildGroups(entries);

  return (
    <div className="px-4 pb-4 md:px-5">
      <div className="lbl-mono flex items-center gap-3 pb-2 pt-4">
        <span className="min-w-0">{TREND_TITLE}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </div>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-dashed border-line-2 py-12">
          <span className="border border-line-2 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            NO TREND
          </span>
          <p className="text-[13px] text-ink-3">{TREND_EMPTY}</p>
        </div>
      ) : (
        <ul className="border border-line-2">
          {groups.map((g) => {
            const values = g.points.map((p) => p.ttft);
            const { dir, pct } = deltaOf(values);
            const tone = TONE[dir];
            return (
              <li
                key={g.key}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3.5 py-3 transition-colors duration-150 last:border-b-0 hover:bg-panel-2"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="truncate text-[13.5px] font-semibold text-ink">{g.label}</span>
                  <p className="font-mono text-[11px] tabular tracking-[0.02em] text-ink-3">
                    <span className="font-semibold text-ink">{g.points.length}</span> {TREND_SAMPLES}
                  </p>
                </div>
                <Sparkline label={g.label} values={values} tone={tone} />
                <span
                  className={`w-[64px] flex-none text-right font-mono text-[12px] font-semibold tabular ${tone}`}
                >
                  {dir === "flat" ? "±0%" : `${dir === "down" ? "↓" : "↑"} ${pct}%`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
