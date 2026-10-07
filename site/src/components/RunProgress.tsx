// 运行进度与代理 consent（FR-006 / Spec §4.1）：
// - consent-required：展示实质说明，用户当次确认后才发请求
// - running：样本 x/y、已用时、取消按钮；role=status 让辅助技术感知更新
// Swiss Industrial Print：分段进度条（ok/bad/mute=已完成、run=在测）+ 脉冲点
// + mono 数据标签（SAMPLE 02/03 两位补零计数制式），零图标库；
// 动效只动 transform/opacity。

import { useEffect, useState } from "react";
import type { SampleResult } from "../../../engine/types";
import {
  CONSENT_ACCEPT,
  CONSENT_BODY,
  CONSENT_DECLINE,
  CONSENT_TITLE,
} from "../content/copy";

export interface RunProgressProps {
  phase: "idle" | "validating" | "consent-required" | "running" | "settled";
  /** sample 为引擎 onProgress 携带的最近完成样本，用于进度条着色 */
  progress: { index: number; total: number; sample?: SampleResult } | null;
  onGrantConsent: () => void;
  onDeclineConsent: () => void;
  onCancel: () => void;
}

/** 两位补零序号（SAMPLE 02/03 印刷计数制式） */
const pad2 = (n: number) => String(n).padStart(2, "0");

/** 已用时计时器：随 running 挂载/卸载，无 effect 内同步 setState */
function ElapsedTimer() {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 200);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular">{(elapsedMs / 1000).toFixed(1)}s</span>;
}

/** 分段槽位着色：已完成=ok（最近一样本按其状态 bad/mute）、在测=run、未开始=空 */
function segmentTone(n: number, index: number, sample?: SampleResult): string {
  if (n === index) {
    if (sample?.status === "failed") return "bg-bad";
    if (sample?.status === "cancelled") return "bg-mute";
    return "bg-ok";
  }
  if (n < index) return "bg-ok";
  if (n === index + 1) return "bg-run";
  return "";
}

/**
 * 分段进度条（agent-hive .pbar 同构）：10px 轨道 + 发丝线分隔的等宽槽位。
 * index = 已完成样本数（引擎逐样本回调后递增）。
 */
function SegmentBar({
  index,
  total,
  sample,
}: {
  index: number;
  total: number;
  sample?: SampleResult;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex-1 h-[10px] bg-panel-2 border border-line flex overflow-hidden"
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-full flex-1 border-r border-line last:border-r-0 ${segmentTone(i + 1, index, sample)}`}
        />
      ))}
    </div>
  );
}

export function RunProgress({
  phase,
  progress,
  onGrantConsent,
  onDeclineConsent,
  onCancel,
}: RunProgressProps) {
  if (phase === "consent-required") {
    return (
      <div
        data-testid="proxy-consent"
        role="alert"
        className="bg-panel border-[1.5px] border-ink border-l-[4px] border-l-warn hard-shadow p-5"
      >
        <p className="lbl-mono">CONSENT · 代理确认</p>
        <div className="mt-2 flex items-center gap-2.5">
          <span className="st-dot bg-warn" aria-hidden="true" />
          <h2 className="text-[15px] font-semibold text-ink">{CONSENT_TITLE}</h2>
        </div>
        <p className="mt-3 text-[13px] text-ink-2 leading-relaxed">
          {CONSENT_BODY}
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onGrantConsent}
            className="h-10 px-4 inline-flex items-center justify-center bg-ink border border-ink text-paper text-sm font-semibold cursor-pointer transition-[opacity,transform] duration-150 ease-[var(--ease)] hover:opacity-90 active:translate-y-[1px]"
          >
            {CONSENT_ACCEPT}
          </button>
          <button
            type="button"
            onClick={onDeclineConsent}
            className="h-10 px-4 inline-flex items-center justify-center bg-panel border border-ink text-ink text-sm font-medium cursor-pointer transition-[opacity,transform] duration-150 ease-[var(--ease)] hover:bg-ink hover:text-paper active:translate-y-[1px]"
          >
            {CONSENT_DECLINE}
          </button>
        </div>
      </div>
    );
  }

  if (phase !== "running") return null;

  const index = progress ? progress.index : 1;
  const totalLabel = progress ? String(progress.total) : "?";

  return (
    <div
      data-testid="run-progress"
      role="status"
      aria-live="polite"
      className="bg-panel border-[1.5px] border-ink hard-shadow p-5"
    >
      {/* 头部：脉冲点 + mono 状态标签 + 取消 */}
      <div className="flex items-center gap-3">
        <span className="pulse-dot bg-run shrink-0" aria-hidden="true" />
        <p className="lbl-mono">
          RUNNING · SAMPLE <span className="tabular">{index}</span>/
          <span className="tabular">{totalLabel}</span>
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto shrink-0 px-3.5 py-2 bg-panel border border-ink font-mono text-xs font-semibold text-ink cursor-pointer transition-[opacity,transform] duration-150 ease-[var(--ease)] hover:bg-ink hover:text-paper active:translate-y-[1px]"
        >
          取消
        </button>
      </div>

      {/* 分段进度条 + mono 计数（SAMPLE 02/03 制式） */}
      {progress && (
        <div className="mt-3 flex items-center gap-3">
          <SegmentBar
            index={progress.index}
            total={progress.total}
            sample={progress.sample}
          />
          <span
            className="tabular text-[11px] font-semibold tracking-[0.08em] text-ink-2 shrink-0"
            aria-hidden="true"
          >
            SAMPLE {pad2(progress.index)}/{pad2(progress.total)}
          </span>
        </div>
      )}

      <p className="mt-2.5 text-xs text-ink-2">
        已用时 <ElapsedTimer /> · 串行执行，避免带宽竞争
      </p>
    </div>
  );
}
