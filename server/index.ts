// 可信代理 Hono app（Worker + Node 同构）。
//
// S01 边界（Spec §4.2/§4.4/§4.5）：
// - Origin 精确 allowlist；无 Origin 的 POST /api/bench 一律 403（curl 只能 /api/health）
// - 上游 host+path 结构化 allowlist、拒绝 IP/本地/非 443/重定向，全部在发起上游请求前完成
// - profile/samples/字段/体积上限逐项校验；该 API 是非幂等计费操作，永不自动重试
// - 日志与错误只含 request id、safe host、profile、samples、耗时、status/error code
// - 响应 Cache-Control: no-store + x-request-id

import { Hono } from "hono";
import { buildProtocolRequest } from "../engine/request";
import { runBenchmark } from "../engine/bench";
import { MEASUREMENT_VERSION } from "../engine/types";
import { configFromEnv, type ServerConfig } from "./config";
import { parseBenchRequest } from "./validation";
import {
  dnsResultIsPrivate,
  findAllowedUpstream,
  isOriginAllowed,
  proxyTargetViolation,
} from "./security";

export interface AppDeps {
  config?: ServerConfig;
  /** 上游 fetch（默认全局 fetch；测试注入 mock upstream） */
  fetchImpl?: typeof fetch;
  /** DNS 解析注入（Node 部署用于拒绝私网解析结果；Worker 不适用） */
  dnsLookup?: (hostname: string) => Promise<string[]>;
}

function errorBody(code: string, safeMessage: string) {
  return { error: { code, message: safeMessage } };
}

export function createApp(deps: AppDeps = {}) {
  const config = deps.config ?? configFromEnv({});
  const fetchImpl = deps.fetchImpl ?? fetch;
  const app = new Hono();

  // CORS：只对 allowlist 内的 Origin 精确回显；其余不带 CORS 头（浏览器侧即失败）
  app.use("/api/*", async (c, next) => {
    const origin = c.req.header("origin");
    if (origin && isOriginAllowed(origin, config)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin");
    }
    await next();
    c.header("Cache-Control", "no-store");
  });

  app.options("/api/bench", (c) => {
    const origin = c.req.header("origin");
    if (!origin || !isOriginAllowed(origin, config)) {
      return c.json(errorBody("ORIGIN_NOT_ALLOWED", "Origin 不在允许列表"), 403);
    }
    c.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    c.header("Access-Control-Max-Age", "600");
    return c.body(null, 204);
  });

  app.post("/api/bench", async (c) => {
    const requestId = crypto.randomUUID();
    c.header("x-request-id", requestId);
    const startedAt = Date.now();

    // ── Origin 门禁（无 Origin 显式拒绝：非浏览器客户端不得调用计费 API） ──
    const origin = c.req.header("origin");
    if (!isOriginAllowed(origin, config)) {
      return c.json(errorBody("ORIGIN_NOT_ALLOWED", "Origin 不在允许列表"), 403);
    }

    // ── Content-Type + 体积 ──
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return c.json(errorBody("INVALID_REQUEST", "Content-Type 必须是 application/json"), 400);
    }
    const rawText = await c.req.text();
    if (rawText.length > config.maxBodyBytes) {
      return c.json(errorBody("BODY_TOO_LARGE", `请求体超过 ${config.maxBodyBytes} 字节上限`), 413);
    }
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawText);
    } catch {
      return c.json(errorBody("INVALID_REQUEST", "请求体必须是合法 JSON"), 400);
    }

    // ── 字段/profile/samples 校验（含 URL 结构规则） ──
    const parsed = parseBenchRequest(rawJson);
    if (!parsed.ok) {
      return c.json(errorBody("INVALID_REQUEST", parsed.message), 400);
    }
    const body = parsed.body;

    // ── 上游 allowlist + 危险目标（全部在发起上游请求前拒绝） ──
    const url = new URL(body.requestUrl);
    const violation = proxyTargetViolation(url);
    if (violation) {
      console.log(
        JSON.stringify({ requestId, host: url.hostname, profile: body.profileId, samples: body.samples, ms: Date.now() - startedAt, status: 403, errorCode: "UPSTREAM_NOT_ALLOWED" }),
      );
      return c.json(errorBody("UPSTREAM_NOT_ALLOWED", violation), 403);
    }
    const upstream = findAllowedUpstream(url, config.allowedUpstreams);
    if (!upstream) {
      console.log(
        JSON.stringify({ requestId, host: url.hostname, profile: body.profileId, samples: body.samples, ms: Date.now() - startedAt, status: 403, errorCode: "UPSTREAM_NOT_ALLOWED" }),
      );
      return c.json(
        errorBody("UPSTREAM_NOT_ALLOWED", "目标不在受信上游列表"),
        403,
      );
    }

    // ── DNS 私网二次校验（仅注入了 dnsLookup 的部署：Node） ──
    if (deps.dnsLookup) {
      try {
        const addresses = await deps.dnsLookup(url.hostname);
        if (dnsResultIsPrivate(addresses)) {
          return c.json(
            errorBody("UPSTREAM_NOT_ALLOWED", "目标解析到私有网络地址"),
            403,
          );
        }
      } catch {
        return c.json(
          errorBody("UPSTREAM_FAILED", "上游域名解析失败"),
          502,
        );
      }
    }

    // ── 执行（总墙钟 = min(profile.timeout × samples + 余量, 硬 cap)） ──
    const totalBudgetMs = Math.min(
      body.profile.timeoutMs * body.samples + 5_000,
      config.hardTimeoutMs,
    );
    const wallClock = AbortSignal.timeout(totalBudgetMs);
    const request = buildProtocolRequest({
      requestUrl: body.requestUrl,
      apiKey: body.apiKey,
      model: body.model,
      protocol: body.protocol,
      profile: body.profile,
    });

    try {
      const run = await runBenchmark(request, {
        protocol: body.protocol,
        samples: body.samples,
        profile: {
          id: body.profile.id,
          version: body.profile.version,
          promptSha256: body.profile.promptSha256,
        },
        transport: "trusted-proxy",
        fetchImpl,
        timeoutMs: body.profile.timeoutMs,
        signal: wallClock,
      });

      console.log(
        JSON.stringify({
          requestId,
          host: upstream.host,
          profile: body.profileId,
          samples: body.samples,
          ms: Date.now() - startedAt,
          status: 200,
          runStatus: run.status,
          successCount: run.successCount,
          errorCode: run.samples.find((s) => s.error)?.error?.code ?? null,
        }),
      );

      // 全部样本均为网络级上游故障（未获得有效 HTTP 应答）→ 502 安全摘要
      const upstreamFailures = run.samples.filter(
        (s) =>
          s.status === "failed" &&
          (s.error?.code === "cors/network" || s.error?.code === "unknown"),
      );
      if (run.status === "failed" && upstreamFailures.length === run.samples.length) {
        return c.json(
          errorBody("UPSTREAM_FAILED", "上游请求失败（安全摘要，不含上游响应）"),
          502,
        );
      }

      return c.json(run, 200);
    } catch (e) {
      // runBenchmark 只在输入非法时抛出（已在上文校验），此处兜底
      console.log(
        JSON.stringify({
          requestId,
          host: upstream.host,
          profile: body.profileId,
          samples: body.samples,
          ms: Date.now() - startedAt,
          status: 500,
          errorCode: "unknown",
        }),
      );
      void e;
      return c.json(errorBody("INTERNAL_ERROR", "代理内部错误"), 500);
    }
  });

  // health：只报告版本与就绪状态；不探测 provider、不泄露 allowlist
  app.get("/api/health", (c) => {
    return c.json({
      ready: true,
      version: "0.2.0",
      measurementVersion: MEASUREMENT_VERSION,
    });
  });

  return app;
}
