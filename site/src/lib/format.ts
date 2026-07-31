// 数字 / 时间格式化 + count-up 缓动

export function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function fmtTps(tps: number): string {
  return tps.toFixed(1);
}

export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
