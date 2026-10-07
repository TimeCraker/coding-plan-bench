// 结果卡（FR-005 / Spec §4.1）：完整呈现 provenance——transport、profile、
// 完整性、成功/请求样本数、token 来源；TPS 不可用时明确说明而非伪装数值。
// Swiss Industrial Print：三段大数字统计带（agent-hive .statsband 同构，
// 44/48px 戏剧化数字 + 单位上标印刷制式）+ 状态校对章（mono 大写 + 状态色描边）
// + mono 逐样本明细表（列内单位恒定）；状态色即语义（方点 + 状态色文字双通道，零图标库）。

import type {
  BenchmarkRunResult,
  RunStatus,
  SampleStatus,
} from "../../../engine/types";
import {
  ERROR_ADVICE,
  METRIC_COPY,
  STATUS_COPY,
  TOKEN_SOURCE_COPY,
  TRANSPORT_COPY,
} from "../content/copy";
import { fmtMs, fmtTps } from "../lib/format";
import { useCountUp } from "../lib/useCountUp";

/** 运行四态 → 状态色（校对章文字/描边、方点、统计带底条共用同一语义） */
const STATUS_TONE: Record<
  RunStatus,
  { text: string; border: string; bar: string }
> = {
  complete: { text: "text-ok", border: "border-ok", bar: "bg-ok" },
  partial: { text: "text-warn", border: "border-warn", bar: "bg-warn" },
  failed: { text: "text-bad", border: "border-bad", bar: "bg-bad" },
  cancelled: { text: "text-mute", border: "border-mute", bar: "bg-mute" },
};

/** 运行状态 → 校对章词（mono 大写印刷记号） */
const STATUS_STAMP: Record<RunStatus, string> = {
  complete: "COMPLETE",
  partial: "PARTIAL",
  failed: "FAILED",
  cancelled: "CANCELLED",
};

/** 统计带上标单位制式：TTFT 恒 ms、Total 恒 s（列内不混排）；TPS 紧凑 tok/s */
const STAT_UNIT = { ttft: "ms", tps: "tok/s", total: "s" } as const;

/** 统计带标签第二段：中文小注 */
const STAT_NOTE = {
  ttft: "首 token 延迟",
  tps: "每秒输出",
  total: "端到端",
} as const;

const SAMPLE_TONE: Record<SampleStatus, { text: string; border: string }> = {
  complete: { text: "text-ok", border: "border-ok" },
  failed: { text: "text-bad", border: "border-bad" },
  cancelled: { text: "text-mute", border: "border-mute" },
};

const SAMPLE_COPY: Record<SampleStatus, string> = {
  complete: "成功",
  failed: "失败",
  cancelled: "已取消",
};

/** 两位补零样本序号（S01–S05 印刷代号制式） */
const pad2 = (n: number) => String(n).padStart(2, "0");

export function ResultCard({ run }: { run: BenchmarkRunResult }) {
  const a = run.aggregate;
  const failedSamples = run.samples.filter((s) => s.error);
  const transportLabel = TRANSPORT_COPY[run.transport]?.label ?? run.transport;
  const tone = STATUS_TONE[run.status];

  return (
    <div
      data-testid="result-card"
      role="status"
      aria-live="polite"
      className="anim-fade-up bg-panel border-[1.5px] border-ink hard-shadow-lg overflow-hidden"
    >
      {/* 头部：状态校对章 + 样本完整性 + provenance */}
      <div className="px-5 md:px-6 py-3.5 border-b border-line bg-panel-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* 校对章：mono 大写为主语言 + 中文状态词细字（双语章，文字与状态色双通道） */}
        <span
          data-testid="result-status"
          className={`inline-flex items-center gap-2 px-2.5 py-1 border font-mono text-xs font-bold tracking-[0.14em] ${tone.text} ${tone.border}`}
        >
          <span className={`st-dot ${tone.bar}`} aria-hidden="true" />
          {STATUS_STAMP[run.status]}
          <span className="font-sans text-[11px] font-medium tracking-normal">
            {STATUS_COPY[run.status]}
          </span>
        </span>
        <span
          data-testid="result-samples"
          className="text-xs text-ink-2 tabular"
        >
          成功样本 {run.successCount}/{run.requestedSamples}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-ink-2">
          <span
            data-testid="result-transport"
            className="px-2 py-0.5 bg-panel border border-line"
          >
            {transportLabel}
          </span>
          <span
            data-testid="result-profile"
            className="px-2 py-0.5 bg-panel border border-line tabular"
          >
            profile {run.profile.id}@{run.profile.version} · 测量 v
            {run.measurementVersion}
          </span>
        </span>
      </div>

      {/* 三段大数字统计带：44/48px 数字 + 单位上标；4px 状态色条随四态变化 */}
      <div className="flex flex-col sm:flex-row border-b border-line">
        <StatCell
          label={METRIC_COPY.ttft.label}
          desc={METRIC_COPY.ttft.desc}
          note={STAT_NOTE.ttft}
          target={a.ttftMs}
          format={(n) => fmtMs(n, "ms")}
          unit={a.ttftMs !== null ? STAT_UNIT.ttft : ""}
          bar={tone.bar}
        />
        <StatCell
          label={METRIC_COPY.tps.label}
          desc={METRIC_COPY.tps.desc}
          note={STAT_NOTE.tps}
          target={a.tps}
          format={fmtTps}
          unit={a.tps !== null ? STAT_UNIT.tps : ""}
          bar={tone.bar}
        />
        <StatCell
          label={METRIC_COPY.total.label}
          desc={METRIC_COPY.total.desc}
          note={STAT_NOTE.total}
          target={a.totalMs}
          format={(n) => fmtMs(n, "s")}
          unit={STAT_UNIT.total}
          bar={tone.bar}
        />
      </div>

      {/* token 来源 */}
      <p
        data-testid="result-token-source"
        className={`px-5 md:px-6 pt-4 text-xs ${a.tps === null ? "text-warn" : "text-ink-2"}`}
      >
        {TOKEN_SOURCE_COPY[a.tokenSource] ?? TOKEN_SOURCE_COPY.unavailable}
        {a.thinkingMs !== null && (
          <span className="text-ink-2"> · 思考阶段 {fmtMs(a.thinkingMs)}</span>
        )}
      </p>

      {/* 逐样本明细：mono 表格（表头双 hairline、S01 补零序号、数值右对齐 tabular、
          状态窄徽章；TTFT 恒 ms / Total 恒 s，列内单位唯一） */}
      <div className="px-5 md:px-6 pt-4 pb-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <thead>
            <tr className="border-y border-line-2">
              <th className="lbl-mono text-left py-2 pr-4">样本</th>
              <th className="lbl-mono text-left py-2 pr-4">状态</th>
              <th className="lbl-mono text-right py-2 pl-4">TTFT</th>
              <th className="lbl-mono text-right py-2 pl-4">TPS</th>
              <th className="lbl-mono text-right py-2 pl-4">Total</th>
              <th className="lbl-mono text-right py-2 pl-4">输出 TOKEN</th>
            </tr>
          </thead>
          <tbody>
            {run.samples.map((s, i) => (
              <tr key={i} className="border-b border-line last:border-b-0">
                <td className="py-2 pr-4 tabular text-ink-2">
                  S{pad2(i + 1)}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`inline-block px-1.5 py-0.5 border text-[11px] font-medium leading-none ${SAMPLE_TONE[s.status].text} ${SAMPLE_TONE[s.status].border}`}
                  >
                    {SAMPLE_COPY[s.status]}
                  </span>
                </td>
                <td className="py-2 pl-4 text-right tabular text-ink">
                  {s.ttftMs !== null ? fmtMs(s.ttftMs, "ms") : "—"}
                </td>
                <td className="py-2 pl-4 text-right tabular text-ink">
                  {s.tps !== null ? fmtTps(s.tps) : "—"}
                </td>
                <td className="py-2 pl-4 text-right tabular text-ink">
                  {fmtMs(s.totalMs, "s")}
                </td>
                <td className="py-2 pl-4 text-right tabular text-ink">
                  {s.outputTokens ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 失败样本与可执行建议（bad 左轨面板） */}
      {failedSamples.length > 0 && (
        <div className="px-5 md:px-6 pb-5 space-y-2">
          {failedSamples.slice(0, 3).map((s, i) => (
            <div
              key={i}
              className="bg-panel-2 border border-line border-l-[4px] border-l-bad p-3 text-xs"
            >
              <p className="font-medium text-ink tabular">
                样本 {run.samples.indexOf(s) + 1} · {s.error?.code}
              </p>
              <p className="text-ink-2 mt-0.5">{s.error?.safeMessage}</p>
              {s.error && ERROR_ADVICE[s.error.code] && (
                <p className="text-accent mt-1">
                  建议：{ERROR_ADVICE[s.error.code]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 统计带单元：lbl-mono 标签 + 中文小注双段式 + mono 大数字（count-up 600ms）
 *  + 单位上标（缩小字号置数字右上，印刷数据制式）+ 底部 4px 状态条 */
function StatCell({
  label,
  desc,
  note,
  target,
  format,
  unit,
  bar,
}: {
  label: string;
  desc: string;
  note: string;
  target: number | null;
  format: (n: number) => string;
  unit: string;
  bar: string;
}) {
  const shown = useCountUp(target ?? 0, 600, 1);
  return (
    <div
      title={desc}
      className="relative flex-1 min-w-0 px-5 md:px-6 pt-4 pb-5 border-b sm:border-b-0 sm:border-r border-line last:border-b-0 sm:last:border-r-0"
    >
      <p className="lbl-mono">{label}</p>
      <p className="mt-0.5 text-[11px] text-ink-3">{note}</p>
      <p
        className={`mt-3 flex items-start font-mono text-[44px] md:text-[48px] font-semibold leading-none tracking-tighter tabular ${target === null ? "text-ink-3" : "text-ink"}`}
      >
        {target === null ? (
          "—"
        ) : (
          <>
            {format(shown)}
            {unit && (
              <span className="ml-1.5 mt-0.5 text-sm font-medium leading-none text-ink-3">
                {unit}
              </span>
            )}
          </>
        )}
      </p>
      <div
        className={`absolute bottom-0 left-0 right-0 h-[4px] ${bar}`}
        aria-hidden="true"
      />
    </div>
  );
}
