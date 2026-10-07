// 顶部安全说明（AC-008）：不再无条件承诺"不上传"——
// Key 路径由用户选择的执行位置决定，文案与 TransportSelector 的事实一致。
// 仅测速台视图渲染（active）：能力榜不看连接方式，语境横幅不给（EYE2 P2-13）；
// Swiss 一行制横幅：panel 底 + 发丝线 + 左侧 3px 珊瑚轨 + 说明句（13px 次级墨，
// line-clamp-2 上限两行，全文进 title）+ 右侧动作簇（下载本地版 / 关闭，mono 描边
// 小方钮，hover 墨反白）；移动端折为句子行 + 动作行两行制，不再 3-4 行堆叠（P2-12）。

import { useState } from "react";
import { LOCAL_APP_DOWNLOAD, SECURITY_BANNER } from "../content/copy";

export function SecurityBanner({ active }: { active: boolean }) {
  const [open, setOpen] = useState(true);
  // 组件保持挂载（open 状态跨视图保留），仅 bench 语境下渲染（P2-13）
  if (!active || !open) return null;
  return (
    <div className="anim-fade-in mt-6 border border-line-2 border-l-[3px] border-l-accent bg-panel md:mt-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <p
          title={SECURITY_BANNER}
          className="min-w-[16ch] flex-1 text-[13px] leading-[1.5] text-ink-2 line-clamp-2"
        >
          {SECURITY_BANNER}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://github.com/TimeCraker/coding-plan-bench/releases"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center border border-line-2 bg-panel px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-2 transition-colors hover:border-ink hover:bg-ink hover:text-paper"
          >
            {LOCAL_APP_DOWNLOAD}
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
