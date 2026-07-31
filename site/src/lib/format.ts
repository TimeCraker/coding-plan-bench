// 数字 / 时间格式化工具

export function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function fmtTps(tps: number): string {
  return tps.toFixed(1);
}

export function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** count-up 动效用的缓动 */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
