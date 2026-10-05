// T-010 部署配置测试（AC-012 / test:deploy-config）：
// _headers 可解析且含必需安全头；wrangler vars 完整；构建产物携带 headers。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const HEADERS_PATH = path.join(ROOT, "site/public/_headers");

function parseHeaders(text: string): Map<string, Record<string, string>> {
  const rules = new Map<string, Record<string, string>>();
  let current: string | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (/^[\w/*.[\]-]+$/.test(line) && !line.includes(":")) {
      current = line;
      rules.set(current, {});
    } else {
      const idx = line.indexOf(":");
      expect(idx, `headers 行格式: ${line}`).toBeGreaterThan(0);
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      expect(current, `headers 行必须跟在 path 规则后: ${line}`).not.toBeNull();
      rules.get(current!)![key] = value;
    }
  }
  return rules;
}

describe("site/public/_headers", () => {
  const rules = parseHeaders(readFileSync(HEADERS_PATH, "utf8"));

  it("含 /* 规则与全部必需安全头（Spec §4.4）", () => {
    const all = rules.get("/*");
    expect(all).toBeDefined();
    expect(all!["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(all!["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(all!["Content-Security-Policy"]).toContain("base-uri 'none'");
    expect(all!["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    // connect-src 允许浏览器直连 HTTPS provider（文档披露）
    expect(all!["Content-Security-Policy"]).toContain("connect-src 'self' https:");
    expect(all!["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(all!["X-Content-Type-Options"]).toBe("nosniff");
    expect(all!["Referrer-Policy"]).toBeTruthy();
    expect(all!["Permissions-Policy"]).toBeTruthy();
    expect(all!["X-Frame-Options"]).toBe("DENY");
  });

  it("HTML no-cache；hash 资源 immutable（Spec §4.7）", () => {
    expect(rules.get("/*")!["Cache-Control"]).toContain("no-cache");
    const assets = rules.get("/assets/*");
    expect(assets!["Cache-Control"]).toContain("immutable");
  });

  it("CSP 不允许内联脚本（script-src 'self'，无 unsafe-inline）", () => {
    const csp = rules.get("/*")!["Content-Security-Policy"];
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
  });
});

describe("wrangler.toml 边界 vars", () => {
  it("CORS_ALLOWED_ORIGINS 与 ALLOWED_UPSTREAMS 已配置（dev 值）", () => {
    const toml = readFileSync(path.join(ROOT, "wrangler.toml"), "utf8");
    expect(toml).toContain("CORS_ALLOWED_ORIGINS");
    expect(toml).toContain("ALLOWED_UPSTREAMS");
    expect(toml).toMatch(/host\|pathPrefix|open\.bigmodel\.cn\|/);
  });
});

describe("deploy workflows 策略", () => {
  it("site workflow：production/preview 分离 + 显式 API base + headers 校验步骤", () => {
    const yml = readFileSync(
      path.join(ROOT, ".github/workflows/deploy-site.yml"),
      "utf8",
    );
    expect(yml).toContain("--branch=main");
    expect(yml).toContain("--branch=preview-");
    expect(yml).toContain("VITE_API_BASE: https://");
    expect(yml).toContain("site/dist/_headers");
    // 不自动创建付费资源：wrangler-action 仅 deploy
    expect(yml).not.toMatch(/pages project create/);
  });

  it("worker workflow：边界 vars 显式 + 先跑 typecheck/security", () => {
    const yml = readFileSync(
      path.join(ROOT, ".github/workflows/deploy-worker.yml"),
      "utf8",
    );
    expect(yml).toContain("--var CORS_ALLOWED_ORIGINS:");
    expect(yml).toContain("--var ALLOWED_UPSTREAMS:");
    expect(yml).toContain("npm run typecheck");
    expect(yml).toContain("npm run test:security");
  });
});

describe("构建产物", () => {
  beforeAll(() => {
    // 本地验证用真实构建产物（CI 同命令）
    execSync("npm run build", {
      cwd: ROOT,
      stdio: "pipe",
      env: { ...process.env, TMP: process.env.TMP, TEMP: process.env.TEMP },
    });
  }, 300_000);

  it("dist 含 _headers 且策略完整", () => {
    const distHeaders = path.join(ROOT, "site/dist/_headers");
    expect(existsSync(distHeaders)).toBe(true);
    const rules = parseHeaders(readFileSync(distHeaders, "utf8"));
    expect(rules.get("/*")!["Content-Security-Policy"]).toBeTruthy();
  });

  it("dist/index.html 引用的脚本均同源（无内联 script）", () => {
    const html = readFileSync(path.join(ROOT, "site/dist/index.html"), "utf8");
    expect(html).not.toMatch(/<script(?![^>]*src=)[^>]*>/);
    expect(html).toMatch(/<script src="\/theme-boot\.js">/);
  });
});
