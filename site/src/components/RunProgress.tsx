// 运行进度与代理 consent（FR-006 / Spec §4.1）：
// - consent-required：展示实质说明，用户当次确认后才发请求
// - running：样本 x/y、已用时、取消按钮；role=status 让辅助技术感知更新

import { useEffect, useState } from "react";
import { ShieldAlert, Loader2, Square } from "lucide-react";
import { CONSENT_ACCEPT, CONSENT_BODY, CONSENT_DECLINE, CONSENT_TITLE } from "../content/copy";

export interface RunProgressProps {
  phase: "idle" | "validating" | "consent-required" | "running" | "settled";
  progress: { index: number; total: number } | null;
  onGrantConsent: () => void;
  onDeclineConsent: () => void;
  onCancel: () => void;
}

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
        className="bg-surface rounded-2xl border border-app shadow-md-card p-5"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-orange-500" />
          </div>
          <h2 className="text-[15px] font-semibold text-app">{CONSENT_TITLE}</h2>
        </div>
        <p className="mt-3 text-[13px] text-muted leading-relaxed">{CONSENT_BODY}</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onGrantConsent}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
          >
            {CONSENT_ACCEPT}
          </button>
          <button
            type="button"
            onClick={onDeclineConsent}
            className="px-4 py-2 rounded-xl bg-surface-2 border border-app text-sm font-medium text-muted hover:text-app transition-colors cursor-pointer"
          >
            {CONSENT_DECLINE}
          </button>
        </div>
      </div>
    );
  }

  if (phase !== "running") return null;

  return (
    <div
      data-testid="run-progress"
      role="status"
      aria-live="polite"
      className="bg-surface rounded-2xl border border-app shadow-md-card p-5 flex items-center gap-4"
    >
      <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-app">
          测速进行中 · 样本 {progress ? progress.index : 1}/
          {progress ? progress.total : "?"}
        </p>
        <p className="text-xs text-muted mt-0.5 tabular">
          已用时 <ElapsedTimer /> · 串行执行，避免带宽竞争
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-2 border border-app text-sm font-medium text-muted hover:text-red-500 hover:border-red-300 transition-colors cursor-pointer shrink-0"
      >
        <Square className="w-3.5 h-3.5" />
        取消
      </button>
    </div>
  );
}
