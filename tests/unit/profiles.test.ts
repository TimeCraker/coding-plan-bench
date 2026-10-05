// T-002 profile 契约测试：cpb-standard@1 固定字段、promptSha256 交叉验证（node:crypto 独立计算）、
// resolveProfile 版本匹配。sha256 纯实现必须同时通过 FIPS 180-4 公开测试向量。
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CPB_STANDARD_PROFILE,
  resolveProfile,
  sha256Hex,
} from "../../engine/profiles";

describe("cpb-standard@1 固定 profile", () => {
  it("id / version / maxTokens / temperature 固定", () => {
    expect(CPB_STANDARD_PROFILE.id).toBe("cpb-standard");
    expect(CPB_STANDARD_PROFILE.version).toBe(1);
    expect(CPB_STANDARD_PROFILE.maxTokens).toBe(1024);
    expect(CPB_STANDARD_PROFILE.temperature).toBe(0);
    expect(CPB_STANDARD_PROFILE.timeoutMs).toBe(90_000);
  });

  it("prompt 足以采集吞吐（长度下限，防退化回 Reply exactly: OK）", () => {
    expect(CPB_STANDARD_PROFILE.prompt.length).toBeGreaterThan(120);
    expect(CPB_STANDARD_PROFILE.prompt.toLowerCase()).not.toContain(
      "reply exactly: ok",
    );
  });

  it("promptSha256 与 node:crypto 独立计算一致", () => {
    const expected = createHash("sha256")
      .update(CPB_STANDARD_PROFILE.prompt, "utf8")
      .digest("hex");
    expect(CPB_STANDARD_PROFILE.promptSha256).toBe(expected);
    expect(CPB_STANDARD_PROFILE.promptSha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("sha256Hex 纯实现", () => {
  it("FIPS 180-4 公开向量", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("UTF-8 多字节（中文）与 node:crypto 一致", () => {
    const input = "测速引擎·可信基准✓";
    expect(sha256Hex(input)).toBe(
      createHash("sha256").update(input, "utf8").digest("hex"),
    );
  });

  it("长输入（>1 个 64 字节块）与 node:crypto 一致", () => {
    const input = "x".repeat(200);
    expect(sha256Hex(input)).toBe(
      createHash("sha256").update(input, "utf8").digest("hex"),
    );
  });
});

describe("resolveProfile", () => {
  it("id+version 匹配返回 profile", () => {
    expect(resolveProfile("cpb-standard", 1)).toBe(CPB_STANDARD_PROFILE);
  });

  it("版本不匹配 / 未知 id 返回 null", () => {
    expect(resolveProfile("cpb-standard", 2)).toBeNull();
    expect(resolveProfile("unknown", 1)).toBeNull();
  });
});
