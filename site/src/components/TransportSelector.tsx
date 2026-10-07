// 连接方式选择（FR-001）：fieldset + radio 显式语义；三选项并排小方框卡。
// transport 是唯一决定 Key 去向的输入——samples 永不影响它。
// 每卡：3px 语义色条（直连=run / 中转=warn / 本地=ok）+ label + 一句话本质；
// detail/keyPath 自然换行不截断（EYE2 P0-1：Key 去向是安全事实，四断点零省略号），
// 全文另有 title 悬停冗余通道——卡文案 ≤ 30 字，最窄断点也 ≤ 3 行。

import type { TransportKind } from "../../../engine/types";
import { LOCAL_APP_DOWNLOAD, TRANSPORT_COPY } from "../content/copy";

interface Props {
  value: TransportKind;
  available: TransportKind[];
  onChange: (t: TransportKind) => void;
}

/** 卡顶语义色条：连接方式的数据语义色（直连=run / 代理=warn / 本地=ok），非装饰。
 *  横排卡各自独立成框，色条同宽即可区分（行式时代靠宽度分琥珀/珊瑚的考量不再适用）。 */
const BAR: Record<TransportKind, string> = {
  "browser-direct": "bg-run",
  "trusted-proxy": "bg-warn",
  "tauri-local": "bg-ok",
};

const DOWNLOAD_URL = "https://github.com/TimeCraker/coding-plan-bench/releases";

export function TransportSelector({ value, available, onChange }: Props) {
  const all: TransportKind[] = ["browser-direct", "trusted-proxy", "tauri-local"];
  const localReady = available.includes("tauri-local");
  return (
    <fieldset
      data-testid="transport-selector"
      className="bg-panel border-[1.5px] border-ink hard-shadow min-w-0"
    >
      <legend className="px-2 text-[13px] font-semibold text-ink bg-panel">连接方式</legend>
      <div className="grid grid-cols-1 md:grid-cols-3 items-stretch gap-2 p-2">
        {all.map((t) => {
          const enabled = available.includes(t);
          const active = value === t && enabled;
          const copy = TRANSPORT_COPY[t];
          return (
            <label
              key={t}
              title={`${copy.label}——${copy.detail} ${copy.keyPath}`}
              className={`relative block min-w-0 border-[1.5px] transition-colors duration-150 ease-(--ease)${
                active
                  ? "border-ink bg-panel-2"
                  : enabled
                    ? "border-line-2 bg-panel hover:border-ink cursor-pointer"
                    : "border-line-2 bg-panel cursor-not-allowed"
              }`}
            >
              {/* radio 视觉隐藏但占满整卡：可聚焦（全局珊瑚 focus 环），点击语义保留。
                  内容层 pointer-events-none 放行点击给 radio，仅下载钮自己接事件。 */}
              <input
                type="radio"
                name="transport"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                checked={active}
                disabled={!enabled}
                onChange={() => enabled && onChange(t)}
              />
              <span aria-hidden="true" className={`block h-[3px] ${BAR[t]}`} />
              <span className="relative z-10 pointer-events-none flex flex-col gap-1 px-3 pt-2 pb-3">
                <span className="flex items-center gap-1.5 min-w-0 pr-5">
                  <span
                    className={`text-sm font-bold min-w-0 ${
                      enabled ? "text-ink" : "text-mute"
                    }`}
                  >
                    {copy.label}
                  </span>
                  {t === "trusted-proxy" && (
                    <span className="lbl-mono flex-none text-warn border border-warn/60 px-1 py-px">
                      需确认
                    </span>
                  )}
                </span>
                <span
                  className={`text-[12px] leading-snug ${
                    enabled ? "text-ink-2" : "text-mute"
                  }`}
                >
                  {copy.detail}
                </span>
                {/* keyPath 第三行：Key 去向安全事实，自然换行不截断（EYE2 P0-1）；本地卡在网页环境改放下载钮（前置显眼） */}
                {t === "tauri-local" && !localReady ? (
                  <a
                    href={DOWNLOAD_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="pointer-events-auto self-start mt-0.5 px-2.5 py-1 font-mono text-[11px] font-semibold text-accent border border-accent bg-panel transition-colors duration-150 ease-(--ease) hover:bg-accent hover:text-paper cursor-pointer"
                  >
                    {LOCAL_APP_DOWNLOAD}
                  </a>
                ) : (
                  <span
                    className={`text-[11px] leading-snug ${
                      enabled ? "text-ink-3" : "text-mute"
                    }`}
                  >
                    {copy.keyPath}
                  </span>
                )}
              </span>
              {active ? (
                <span aria-hidden="true" className="absolute top-1.5 right-1.5 st-dot bg-accent" />
              ) : (
                !enabled && (
                  <span aria-hidden="true" className="absolute top-1.5 right-1.5 lbl-mono">
                    N/A
                  </span>
                )
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
