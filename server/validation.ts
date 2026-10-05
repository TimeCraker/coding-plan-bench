// /api/bench 请求体校验（Spec §4.2 约束的机械执行）。
// profile 只能引用服务端内置且版本精确匹配的 profile——客户端不提交 prompt/maxTokens。

import { isSampleCount, type Protocol } from "../engine/types";
import { validateRequestUrl } from "../engine/request";
import { resolveProfile } from "../engine/profiles";
import type { BenchmarkProfile } from "../engine/types";

export interface BenchRequestBody {
  requestUrl: string;
  apiKey: string;
  model: string;
  protocol: Protocol;
  profileId: string;
  profileVersion: number;
  samples: 1 | 3 | 5;
  profile: BenchmarkProfile;
}

export type RequestValidation =
  | { ok: true; body: BenchRequestBody }
  | { ok: false; field?: string; message: string };

const MAX_URL_CHARS = 2048;

export function parseBenchRequest(raw: unknown): RequestValidation {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "请求体必须是 JSON 对象" };
  }
  const o = raw as Record<string, unknown>;

  const { requestUrl, apiKey, model, protocol, profileId, profileVersion, samples } = o;
  if (typeof requestUrl !== "string" || requestUrl.length === 0) {
    return { ok: false, field: "requestUrl", message: "requestUrl 必须是非空字符串" };
  }
  if (requestUrl.length > MAX_URL_CHARS) {
    return { ok: false, field: "requestUrl", message: `requestUrl 超过 ${MAX_URL_CHARS} 字符上限` };
  }
  if (typeof apiKey !== "string" || apiKey.length < 1 || apiKey.length > 512) {
    return { ok: false, field: "apiKey", message: "apiKey 长度必须在 1–512 字符" };
  }
  if (typeof model !== "string" || model.length < 1 || model.length > 128) {
    return { ok: false, field: "model", message: "model 长度必须在 1–128 字符" };
  }
  if (protocol !== "anthropic" && protocol !== "openai") {
    return { ok: false, field: "protocol", message: "protocol 必须是 anthropic 或 openai" };
  }
  if (typeof profileId !== "string" || typeof profileVersion !== "number") {
    return { ok: false, field: "profile", message: "profileId/profileVersion 缺失或类型错误" };
  }
  const profile = resolveProfile(profileId, profileVersion);
  if (!profile) {
    return {
      ok: false,
      field: "profile",
      message: "profile 不在服务端内置列表或版本不匹配",
    };
  }
  if (typeof samples !== "number" || !isSampleCount(samples)) {
    return { ok: false, field: "samples", message: "samples 只允许 1/3/5" };
  }

  const urlCheck = validateRequestUrl(requestUrl);
  if (!urlCheck.ok) {
    return { ok: false, field: "requestUrl", message: urlCheck.reason };
  }

  return {
    ok: true,
    body: {
      requestUrl,
      apiKey,
      model,
      protocol,
      profileId,
      profileVersion,
      samples,
      profile,
    },
  };
}
