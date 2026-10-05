// 结果卡（FR-005 / Spec §4.1）：完整呈现 provenance——transport、profile、
// 完整性、成功/请求样本数、token 来源；TPS 不可用时明确说明而非伪装数值。

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Ban } from "lucide-react";
import type { BenchmarkRunResult } from "../../../engine/types";
import {
  ERROR_ADVICE,
  METRIC_COPY,
  STATUS_COPY,
  TOKEN_SOURCE_COPY,
  TRANSPORT_COPY,
} from "../content/copy";
import { fmtMs, fmtTps } from "../lib/format";

const ease = [0.16, 1, 0.3, 1] as const;

const STATUS_ICON = {
  complete: <CheckCircle2 className="w-4 h-4 text-success" />,
  partial: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  cancelled: <Ban className="w-4 h-4 text-muted" />,
} as const;

export function ResultCard({ run }: { run: BenchmarkRunResult }) {
  const a = run.aggregate;
  const failedSamples = run.samples.filter((s) => s.error);
  const transportLabel = TRANSPORT_COPY[run.transport]?.label ?? run.transport;

  return (
    <motion.div
      data-testid="result-card"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      className="bg-surface rounded-2xl border border-app shadow-lg-card overflow-hidden"
    >
      {/* 头部：状态 + 样本完整性 */}
      <div className="px-5 md:px-6 py-4 border-b border-app bg-surface-2/50 flex flex-wrap items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-app">
          {STATUS_ICON[run.status]}
        </div>
        <span
          data-testid="result-status"
          className="font-semibold text-app text-[15px]"
        >
          {STATUS_COPY[run.status]}
        </span>
        <span
          data-testid="result-samples"
          className="text-xs text-muted tabular"
        >
          成功样本 {run.successCount}/{run.requestedSamples}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span
            data-testid="result-transport"
            className="px-2 py-0.5 rounded-md bg-surface border border-app"
          >
            {transportLabel}
          </span>
          <span
            data-testid="result-profile"
            className="px-2 py-0.5 rounded-md bg-surface border border-app tabular"
          >
            profile {run.profile.id}@{run.profile.version} · 测量 v
            {run.measurementVersion}
          </span>
        </span>
      </div>

      {/* 指标 */}
      <div className="p-5 md:p-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric
          label={METRIC_COPY.ttft.label}
          desc={METRIC_COPY.ttft.desc}
          value={a.ttftMs !== null ? fmtMs(a.ttftMs) : "—"}
          unit={a.ttftMs !== null ? METRIC_COPY.ttft.unit : ""}
        />
        <Metric
          label={METRIC_COPY.tps.label}
          desc={METRIC_COPY.tps.desc}
          value={a.tps !== null ? fmtTps(a.tps) : "不可用"}
          unit={a.tps !== null ? METRIC_COPY.tps.unit : ""}
          highlight
        />
        <Metric
          label={METRIC_COPY.total.label}
          desc={METRIC_COPY.total.desc}
          value={fmtMs(a.totalMs)}
          unit={METRIC_COPY.total.unit}
        />
      </div>

      {/* token 来源 */}
      <p
        data-testid="result-token-source"
        className={`px-5 md:px-6 pb-4 text-xs ${a.tps === null ? "text-orange-500" : "text-muted"}`}
      >
        {TOKEN_SOURCE_COPY[a.tokenSource] ?? TOKEN_SOURCE_COPY.unavailable}
        {a.thinkingMs !== null && (
          <span className="text-muted"> · 思考阶段 {fmtMs(a.thinkingMs)}</span>
        )}
      </p>

      {/* 失败样本与可执行建议 */}
      {failedSamples.length > 0 && (
        <div className="px-5 md:px-6 pb-5 space-y-2">
          {failedSamples.slice(0, 3).map((s, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-2 border border-app p-3 text-xs"
            >
              <p className="font-medium text-app">
                样本 {run.samples.indexOf(s) + 1} · {s.error?.code}
              </p>
              <p className="text-muted mt-0.5">{s.error?.safeMessage}</p>
              {s.error && ERROR_ADVICE[s.error.code] && (
                <p className="text-primary mt-1">
                  建议：{ERROR_ADVICE[s.error.code]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Metric({
  label,
  desc,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  desc: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div
      title={desc}
      className={`rounded-xl p-4 border ${highlight ? "bg-primary-soft border-primary/20" : "bg-surface-2 border-app"}`}
    >
      <div className="flex items-center gap-1.5 text-muted text-[11px] mb-2">
        <span className={`font-medium ${highlight ? "text-primary" : ""}`}>
          {label}
        </span>
      </div>
      <div
        className={`tabular text-2xl font-bold ${highlight ? "text-primary" : "text-app"}`}
      >
        {value}
        {unit && (
          <span className="text-xs font-medium text-muted ml-1">{unit}</span>
        )}
      </div>
    </div>
  );
}
