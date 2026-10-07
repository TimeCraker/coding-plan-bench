// 执行位置选择（FR-001）：fieldset + radio 显式语义；每个选项直接展示 Key 路径。
// transport 是唯一决定 Key 去向的输入——samples 永不影响它。
// Swiss 行式选择列表：墨线外框 + 3px 语义色轨 + 选中珊瑚方标，零圆角零图标。

import type { TransportKind } from "../../../engine/types";
import { LOCAL_APP_HINT, TRANSPORT_COPY } from "../content/copy";

interface Props {
  value: TransportKind;
  available: TransportKind[];
  onChange: (t: TransportKind) => void;
}

/** 左侧 3px 状态轨：执行位置的数据语义色（直连=run / 代理=warn / 本地=ok），非装饰 */
const RAIL: Record<TransportKind, string> = {
  "browser-direct": "bg-run",
  "trusted-proxy": "bg-warn",
  "tauri-local": "bg-ok",
};

export function TransportSelector({ value, available, onChange }: Props) {
  const all: TransportKind[] = ["browser-direct", "trusted-proxy", "tauri-local"];
  return (
    <fieldset
      data-testid="transport-selector"
      className="bg-panel border-[1.5px] border-ink hard-shadow min-w-0"
    >
      <legend className="px-2 text-[13px] font-semibold text-ink bg-panel">
        执行位置（决定 Key 路径）
      </legend>
      <div>
        {all.map((t, i) => {
          const enabled = available.includes(t);
          const active = value === t && enabled;
          const copy = TRANSPORT_COPY[t];
          return (
            <label
              key={t}
              className={`relative flex items-stretch transition-colors duration-150 ease-(--ease)${
                i > 0 ? " border-t border-line" : ""
              } ${
                active
                  ? "bg-panel-2 cursor-pointer"
                  : enabled
                    ? "bg-panel hover:bg-panel-2 cursor-pointer"
                    : "bg-panel cursor-not-allowed"
              }`}
            >
              {/* radio 视觉隐藏但占满整行：可聚焦（全局珊瑚 focus 环），点击语义保留 */}
              <input
                type="radio"
                name="transport"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                checked={active}
                disabled={!enabled}
                onChange={() => enabled && onChange(t)}
              />
              <span aria-hidden="true" className={`w-[3px] flex-none ${RAIL[t]}`} />
              <span className="flex-1 min-w-0 px-4 py-3 flex flex-col gap-1">
                <span
                  className={`text-[13px] font-semibold ${enabled ? "text-ink" : "text-mute"}`}
                >
                  {copy.label}
                </span>
                <span
                  className={`text-xs leading-relaxed ${enabled ? "text-ink-2" : "text-mute"}`}
                >
                  {copy.keyPath}
                </span>
              </span>
              <span className="flex items-center pr-4 flex-none">
                {active ? (
                  <span aria-hidden="true" className="w-2 h-2 bg-accent" />
                ) : (
                  !enabled && <span className="lbl-mono">N/A</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {!available.includes("tauri-local") && (
        <p className="border-t border-line px-4 py-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10.5px] text-ink-3 leading-relaxed">
          <span aria-hidden="true">↓</span>
          {LOCAL_APP_HINT}
          <a
            href="https://github.com/TimeCraker/coding-plan-bench/releases"
            target="_blank"
            rel="noreferrer"
            className="text-accent font-semibold hover:underline"
          >
            下载
          </a>
        </p>
      )}
    </fieldset>
  );
}
