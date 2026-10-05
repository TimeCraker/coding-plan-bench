// T-005 请求构造单测（AC-005）：完整 Request URL 原样、协议 fixture 一致、URL 结构校验。
import { describe, expect, it } from "vitest";
import {
  buildProtocolRequest,
  validateRequestUrl,
} from "../../engine/request";
import { CPB_STANDARD_PROFILE } from "../../engine/profiles";

const INPUT = {
  requestUrl: "https://api.openai.com/v1/chat/completions",
  apiKey: "test-key-material",
  model: "glm-5.3",
  profile: CPB_STANDARD_PROFILE,
};

describe("buildProtocolRequest", () => {
  it("URL 原样使用，不追加任何 path（/v1 不再重复，AUD-010）", () => {
    for (const protocol of ["anthropic", "openai"] as const) {
      const req = buildProtocolRequest({ ...INPUT, protocol });
      expect(req.url).toBe(INPUT.requestUrl);
      expect(req.url.match(/\/v1/g)?.length).toBe(1);
    }
  });

  it("anthropic：body 字段与 profile 一致；headers 含版本与双凭证头", () => {
    const req = buildProtocolRequest({ ...INPUT, protocol: "anthropic" });
    const body = JSON.parse(req.body);
    expect(body).toEqual({
      model: INPUT.model,
      max_tokens: CPB_STANDARD_PROFILE.maxTokens,
      temperature: CPB_STANDARD_PROFILE.temperature,
      stream: true,
      messages: [{ role: "user", content: CPB_STANDARD_PROFILE.prompt }],
    });
    expect(req.headers["anthropic-version"]).toBe("2023-06-01");
    expect(req.headers["x-api-key"]).toBe(INPUT.apiKey);
    expect(req.headers.Authorization).toBe(`Bearer ${INPUT.apiKey}`);
  });

  it("openai：body 含 stream_options.include_usage；headers 无 anthropic 专用头", () => {
    const req = buildProtocolRequest({ ...INPUT, protocol: "openai" });
    const body = JSON.parse(req.body);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.max_tokens).toBe(CPB_STANDARD_PROFILE.maxTokens);
    expect(req.headers["anthropic-version"]).toBeUndefined();
    expect(req.headers["x-api-key"]).toBeUndefined();
    expect(req.headers.Authorization).toBe(`Bearer ${INPUT.apiKey}`);
  });

  it("prompt 一律来自 profile（客户端无法注入任意 prompt）", () => {
    const req = buildProtocolRequest({ ...INPUT, protocol: "openai" });
    const body = JSON.parse(req.body);
    expect(body.messages[0].content).toBe(CPB_STANDARD_PROFILE.prompt);
  });
});

describe("validateRequestUrl", () => {
  it("合法 HTTPS 通过", () => {
    expect(validateRequestUrl("https://api.example.com/v1/messages").ok).toBe(true);
    expect(validateRequestUrl("https://api.example.com:443/v1/messages").ok).toBe(true);
  });

  it("HTTP 拒绝", () => {
    expect(validateRequestUrl("http://api.example.com/v1").ok).toBe(false);
  });

  it("credentials 拒绝", () => {
    expect(validateRequestUrl("https://user:pass@api.example.com/v1").ok).toBe(false);
  });

  it("fragment 拒绝", () => {
    expect(validateRequestUrl("https://api.example.com/v1#frag").ok).toBe(false);
  });

  it("非 443 端口拒绝", () => {
    expect(validateRequestUrl("https://api.example.com:8443/v1").ok).toBe(false);
  });

  it("无法解析拒绝", () => {
    expect(validateRequestUrl("not-a-url").ok).toBe(false);
  });
});
