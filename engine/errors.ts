// 稳定错误码与安全错误对象（Spec §4.5）。
// 契约：错误只携带 code + safeMessage；safeMessage 不得包含上游 body、Key、完整 query。

import type { BenchErrorCode } from "./types";

export interface BenchError {
  code: BenchErrorCode;
  safeMessage: string;
}

/** Spec §4.5 固定错误码集合（穷举、去重） */
export const ERROR_CODES: readonly BenchErrorCode[] = [
  "validation",
  "consent",
  "cors/network",
  "auth",
  "rate-limit",
  "timeout",
  "protocol/parse",
  "empty-output",
  "usage-unavailable",
  "cancelled",
  "proxy-policy",
  "unknown",
];

export function isBenchErrorCode(x: unknown): x is BenchErrorCode {
  return typeof x === "string" && (ERROR_CODES as readonly string[]).includes(x);
}

export function benchError(code: BenchErrorCode, safeMessage: string): BenchError {
  return { code, safeMessage };
}

/** 上游 HTTP status → 稳定错误码（不读上游 body，绝不回显） */
export function codeFromHttpStatus(status: number): BenchErrorCode {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate-limit";
  if (status === 408 || status === 504) return "timeout";
  return "unknown";
}

/** fetch 抛出的异常 → 稳定错误码（TypeError=CORS/网络；AbortError 分超时/用户取消） */
export function codeFromFetchError(
  err: unknown,
  opts: { userCancelled: boolean },
): BenchErrorCode {
  if (opts.userCancelled) return "cancelled";
  if (err instanceof DOMException && err.name === "AbortError") return "timeout";
  if (err instanceof TypeError) return "cors/network";
  return "unknown";
}

/** 脱敏：截断 + 去掉可能的换行，保证日志/错误文本体积可控 */
export function sanitizeMessage(raw: string, maxLen = 200): string {
  const flat = raw.replace(/\s+/g, " ").trim();
  return flat.length > maxLen ? `${flat.slice(0, maxLen)}…` : flat;
}
