// T-010 文档一致性测试（AC-012 / test:docs）：
// README 里的每条 npm 命令真实存在；无旧无条件承诺；拓扑声明与 CI 一致。
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const README = readFileSync(path.join(ROOT, "README.md"), "utf8");
const PKG = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

describe("README 命令真实存在", () => {
  it("代码块中的每个 npm run <script> 都在 package.json scripts 里", () => {
    const used = [...README.matchAll(/npm run ([a-z0-9:.-]+)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(8);
    const missing = [...new Set(used)].filter(
      (s) => !(s in PKG.scripts) && !["tauri"].some((p) => s.startsWith(p)),
    );
    // npm run tauri dev / tauri build 是 npm run tauri 的参数形式，单独放行
    expect(missing.filter((m) => !m.startsWith("tauri"))).toEqual([]);
  });

  it("质量门禁命令齐全（typecheck/lint/test:*/build）", () => {
    for (const key of [
      "typecheck",
      "lint",
      "test:unit",
      "test:integration",
      "test:security",
      "test:e2e",
      "test:a11y",
      "test:responsive",
      "test:visual",
      "build",
    ]) {
      expect(PKG.scripts[key], `missing script: ${key}`).toBeTruthy();
    }
  });
});

describe("无旧无条件承诺", () => {
  it("README 不含 终极判据 / 任意模型 / 不上传 / 反映本机当前真实表现", () => {
    expect(README).not.toContain("终极判据");
    expect(README).not.toContain("任意模型");
    expect(README).not.toContain("不上传");
    expect(README).not.toContain("反映本机当前真实表现");
  });

  it("Key 去向描述与三种 transport 一致（含浏览器直连/中转代理/本地软件）", () => {
    expect(README).toContain("浏览器直连");
    expect(README).toContain("中转代理");
    expect(README).toContain("本地软件");
    // 代理的实质披露
    expect(README).toContain("内存转发");
  });
});

describe("拓扑一致（README ↔ CI workflows）", () => {
  it("Cloudflare Pages 是唯一主站（README 主域 = pages.dev）", () => {
    expect(README).toContain("coding-plan-bench.pages.dev");
    // README 不把 GitHub Pages 描述为部署目标（澄清性否定语句允许）
    expect(README).not.toContain("部署到 GitHub Pages");
    expect(README).not.toContain("gh-pages 分支");
  });

  it("deploy-site.yml 与 deploy-worker.yml 存在，且无 gh-pages 残留 workflow", () => {
    const deploySite = readFileSync(
      path.join(ROOT, ".github/workflows/deploy-site.yml"),
      "utf8",
    );
    const deployWorker = readFileSync(
      path.join(ROOT, ".github/workflows/deploy-worker.yml"),
      "utf8",
    );
    expect(deploySite).toContain("cloudflare/wrangler-action");
    expect(deploySite).toContain("VITE_API_BASE");
    expect(deploySite).toContain("--branch=main");
    expect(deployWorker).toContain("CORS_ALLOWED_ORIGINS");
    expect(deployWorker).toContain("ALLOWED_UPSTREAMS");
    expect(deploySite).not.toContain("peaceiris");
    expect(deployWorker).not.toContain("peaceiris");
  });
});
