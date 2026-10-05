// trusted-proxy：只有当次显式 consent token 才调用项目 Worker（FR-001 / AC-003）。
// 无 consent → 抛 consent 错误，不发出任何网络请求。
// 代理响应错误码映射回稳定错误集合；Key 只进入请求体（TLS），不落日志/存储。

import type {
  BenchmarkRunResult,
  BenchErrorCode,
} from "../../../../engine/types";
import { benchError, type BenchError } from "../../../../engine/errors";
import { getApiBase } from "../runtime";
import type { Transport } from "./types";

/** 显式同意令牌：UI 在用户当次确认后生成（opaque，防被静默预置） */
export interface ConsentToken {
  readonly kind: "trusted-proxy-consent";
  readonly value: string;
}

export function createConsentToken(): ConsentToken {
  return {
    kind: "trusted-proxy-consent",
    value: crypto.randomUUID(),
  };
}

/** 代理端 UPPER_SNAKE 错误码 → 客户端稳定错误码 */
function mapProxyErrorCode(code: string | undefined): BenchErrorCode {
  switch (code) {
    case "ORIGIN_NOT_ALLOWED":
    case "UPSTREAM_NOT_ALLOWED":
      return "proxy-policy";
    case "INVALID_REQUEST":
    case "BODY_TOO_LARGE":
      return "validation";
    case "RATE_LIMITED":
      return "rate-limit";
    case "BENCH_TIMEOUT":
      return "timeout";
    case "UPSTREAM_FAILED":
      return "unknown";
    default:
      return "unknown";
  }
}

export function createTrustedProxyTransport(opts: {
  consent?: ConsentToken;
  fetchImpl?: typeof fetch;
  apiBase?: string;
}): Transport {
  const fetchImpl =
    opts.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, init));
  const apiBase = opts.apiBase ?? getApiBase();
  return {
    kind: "trusted-proxy",
    async run(req) {
      if (!opts.consent) {
        throw benchError(
          "consent",
          "使用项目代理需要当次明确同意（Key 将经项目 Worker 内存转发）",
        );
      }
      const res = await fetchImpl(`${apiBase}/bench`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestUrl: req.requestUrl,
          apiKey: req.apiKey,
          model: req.model,
          protocol: req.protocol,
          profileId: req.profile.id,
          profileVersion: req.profile.version,
          samples: req.samples,
        }),
        signal: req.signal,
      });

      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw benchError("unknown", "代理响应不是合法 JSON");
      }

      if (!res.ok) {
        const err = (json as { error?: { code?: string; message?: string } })
          .error;
        throw benchError(
          mapProxyErrorCode(err?.code),
          err?.message ?? `代理请求失败（HTTP ${res.status}）`,
        );
      }

      const run = json as BenchmarkRunResult;
      if (run.schemaVersion !== 2) {
        throw benchError("protocol/parse", "代理响应 schema 版本不兼容");
      }
      // 代理侧执行位置归一为 trusted-proxy（防上游误标）
      return { ...run, transport: "trusted-proxy" };
    },
  };
}

export type { BenchError };
