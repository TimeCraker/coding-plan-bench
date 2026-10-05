// 协议请求构造（FR-002 / AUD-010 根治）：
// 用户输入完整 HTTPS Request URL，这里只构造 body 与 headers，URL 原样使用——
// 不再拼接 /v1/messages 或 /v1/chat/completions，彻底消除双重 `/v1`。

import type { BenchmarkProfile, Protocol } from "./types";

/** 已构造好的协议请求（URL 原样；transport 层直接 fetch） */
export interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface ProtocolRequestInput {
  /** 完整 Request URL，如 https://api.anthropic.com/v1/messages */
  requestUrl: string;
  apiKey: string;
  model: string;
  protocol: Protocol;
  profile: BenchmarkProfile;
}

export type UrlValidation =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/**
 * URL 结构校验（传输无关的基础规则；host allowlist / IP 私网检查在 server/security）：
 * - 必须 HTTPS
 * - 无 credentials（user:pass@）
 * - 无 fragment
 * - 端口为空或 443
 */
export function validateRequestUrl(raw: string): UrlValidation {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "URL 无法解析" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "Request URL 必须是 HTTPS" };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "Request URL 不允许携带 credentials" };
  }
  if (url.hash !== "") {
    return { ok: false, reason: "Request URL 不允许携带 fragment" };
  }
  if (url.port !== "" && url.port !== "443") {
    return { ok: false, reason: "Request URL 只允许标准 443 端口" };
  }
  if (url.hostname === "") {
    return { ok: false, reason: "Request URL 缺少 host" };
  }
  return { ok: true, url };
}

/** 按协议构造 headers + body（profile 决定 prompt/maxTokens/temperature） */
export function buildProtocolRequest(input: ProtocolRequestInput): BuiltRequest {
  const messages = [{ role: "user", content: input.profile.prompt }];

  if (input.protocol === "anthropic") {
    return {
      url: input.requestUrl,
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.profile.maxTokens,
        temperature: input.profile.temperature,
        stream: true,
        messages,
      }),
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        Authorization: `Bearer ${input.apiKey}`,
        "x-api-key": input.apiKey,
      },
    };
  }

  return {
    url: input.requestUrl,
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.profile.maxTokens,
      temperature: input.profile.temperature,
      stream: true,
      stream_options: { include_usage: true },
      messages,
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
  };
}
