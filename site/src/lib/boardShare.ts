// 榜单分享导出（wave22：复制榜单）：
// - buildBoardMarkdown：纯函数——当前可比条目（rankable、按当前排序指标排序）→ markdown 文本
// - copyText：clipboard API 优先，textarea + execCommand 回落（Tauri webview 兼容）
// 只读消费 LeaderboardEntryV2，不写 storage

import type { LeaderboardEntryV2 } from "../../../engine/types";
import { fmtMs, fmtTps } from "./format";
import { rankableForMetric, type RankableMetric } from "./storage";

/** 排序方向与榜单视图一致：ttft/total 越低越好，tps 越高越好 */
const LOWER_BETTER: Record<RankableMetric, boolean> = {
  ttft: true,
  tps: false,
  total: true,
};

function metricNumber(e: LeaderboardEntryV2, m: RankableMetric): number | null {
  if (!e.run) return null;
  if (m === "ttft") return e.run.aggregate.ttftMs;
  if (m === "tps") return e.run.aggregate.tps;
  return e.run.aggregate.totalMs;
}

/** markdown 表格单元格守卫：用户 label 可能含竖线/换行，会破坏表格结构 */
function mdCell(text: string): string {
  return text.replace(/\|/g, "/").replace(/[\r\n]+/g, " ").trim();
}

/** 条件行：profile@version · transport 分组（mono 语义，与站内可比口径一致） */
function conditionLine(entries: readonly LeaderboardEntryV2[]): string | null {
  const conds = new Set<string>();
  for (const e of entries) {
    if (!e.run) continue;
    conds.add(`${e.run.profile.id}@${e.run.profile.version} · ${e.run.transport}`);
  }
  if (conds.size === 0) return null;
  const list = [...conds];
  return `条件：${list.join(" ／ ")}${list.length > 1 ? `（${list.length} 组）` : ""}`;
}

/**
 * 可比条目 → 分享用 markdown：
 * 表头（条数）+ 条件行（profile · transport）+ `# | 模型 | TTFT | TPS | Total` 表
 * + 尾行免责。数值用现有 fmt 格式，列内单位恒定（TTFT 恒 ms / Total 恒 s）。
 */
export function buildBoardMarkdown(
  entries: readonly LeaderboardEntryV2[],
  sortKey: RankableMetric,
): string {
  const rankable = entries.filter((e) => rankableForMetric(e, sortKey));
  const sorted = [...rankable].sort((a, b) => {
    const va = metricNumber(a, sortKey) ?? 0;
    const vb = metricNumber(b, sortKey) ?? 0;
    return LOWER_BETTER[sortKey] ? va - vb : vb - va;
  });

  const lines: string[] = [`# Coding Plan Bench · 本机榜单（${sorted.length} 条）`];

  const cond = conditionLine(sorted);
  if (cond) lines.push("", cond);

  if (sorted.length === 0) {
    lines.push("", "还没有可比较的记录。");
  } else {
    lines.push(
      "",
      "| # | 模型 | TTFT | TPS | Total |",
      "| --- | --- | --- | --- | --- |",
    );
    sorted.forEach((e, i) => {
      const ttft = e.run?.aggregate.ttftMs;
      const tps = e.run?.aggregate.tps;
      lines.push(
        `| ${String(i + 1).padStart(2, "0")} | ${mdCell(e.label || e.model)} | ${
          ttft == null ? "—" : fmtMs(ttft, "ms")
        } | ${tps == null ? "—" : fmtTps(tps)} | ${fmtMs(e.run?.aggregate.totalMs ?? 0, "s")} |`,
      );
    });
  }

  lines.push("", "> 数据仅存本地，测试条件见站内方法学。");
  return lines.join("\n");
}

/** 剪贴板写入：navigator.clipboard 优先（安全上下文）；
 *  失败或不可用（Tauri webview 权限缺失 / http 环境）回落 textarea + execCommand */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落入下方回落
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
