// 顶部安全说明（AC-008）：不再无条件承诺"不上传"——
// Key 路径由用户选择的执行位置决定，文案与 TransportSelector 的事实一致。
// Swiss 信息横幅语言：panel 底 + 发丝线 + 左侧 4px 珊瑚色轨 + lbl-mono eyebrow
// + 按钮簇统一 mono 描边小方钮（hover 墨反白，对齐全站小钮语言）。

import { useState } from "react";
import { SECURITY_BANNER } from "../content/copy";

export function SecurityBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="anim-fade-in mt-6 border border-line-2 border-l-[4px] border-l-accent bg-panel md:mt-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-[13px]">
        <div className="min-w-0 flex-1">
          <p className="lbl-mono">SECURITY · KEY 路径</p>
          <p className="mt-1.5 leading-relaxed text-ink-2">{SECURITY_BANNER}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://github.com/TimeCraker/coding-plan-bench/releases"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center border border-line-2 bg-panel px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-2 transition-colors hover:border-ink hover:bg-ink hover:text-paper sm:inline-flex"
          >
            下载本地版
          </a>
          <button
            onClick={() => setOpen(false)}
            aria-label="关闭安全说明"
            className="shrink-0 cursor-pointer border border-line-2 bg-panel px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-2 transition-colors hover:border-ink hover:bg-ink hover:text-paper"
          >
            关闭安全说明
          </button>
        </div>
      </div>
    </div>
  );
}
