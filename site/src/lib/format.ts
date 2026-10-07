// 数字 / 时间格式化 + count-up 缓动

/** 时长单位策略：auto=按量级自适应（旧行为）；ms/s=列内恒定单位（表格列排版用，避免同列 ms/s 混排） */
export type DurationUnit = "auto" | "ms" | "s";

export function fmtMs(ms: number, unit: DurationUnit = "auto"): string {
  if (unit === "ms") return `${Math.round(ms)}ms`;
  if (unit === "s") return `${(ms / 1000).toFixed(2)}s`;
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
