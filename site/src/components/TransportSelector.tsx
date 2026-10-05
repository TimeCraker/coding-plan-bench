// 执行位置选择（FR-001）：fieldset + radio 显式语义；每个选项直接展示 Key 路径。
// transport 是唯一决定 Key 去向的输入——samples 永不影响它。

import type { TransportKind } from "../../../engine/types";
import { LOCAL_APP_HINT, TRANSPORT_COPY } from "../content/copy";
import { Download } from "lucide-react";

interface Props {
  value: TransportKind;
  available: TransportKind[];
  onChange: (t: TransportKind) => void;
}

export function TransportSelector({ value, available, onChange }: Props) {
  const all: TransportKind[] = ["browser-direct", "trusted-proxy", "tauri-local"];
  return (
    <fieldset
      data-testid="transport-selector"
      className="bg-surface rounded-2xl border border-app shadow-md-card p-5"
    >
      <legend className="text-[13px] font-semibold text-app px-1">
        执行位置（决定 Key 路径）
      </legend>
      <div className="mt-3 space-y-2">
        {all.map((t) => {
          const enabled = available.includes(t);
          const active = value === t && enabled;
          const copy = TRANSPORT_COPY[t];
          return (
            <label
              key={t}
              className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors cursor-pointer ${
                active
                  ? "border-primary bg-primary-soft"
                  : enabled
                    ? "border-app bg-surface-2 hover:border-strong"
                    : "border-app bg-surface-2 opacity-50 cursor-not-allowed"
              }`}
            >
              <input
                type="radio"
                name="transport"
                className="mt-1 accent-[var(--primary)]"
                checked={active}
                disabled={!enabled}
                onChange={() => enabled && onChange(t)}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-app">
                  {copy.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted leading-relaxed">
                  {copy.keyPath}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {!available.includes("tauri-local") && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
          <Download className="w-3 h-3 shrink-0" />
          {LOCAL_APP_HINT}
          <a
            href="https://github.com/TimeCraker/coding-plan-bench/releases"
            target="_blank"
            rel="noreferrer"
            className="text-primary font-medium hover:underline"
          >
            下载
          </a>
        </p>
      )}
    </fieldset>
  );
}
