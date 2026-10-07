// T-007 主流程 e2e：transport consent 与 progress/cancel（AC-003）。
// provider 与代理均用 route mock，绝不访问真实上游。

import { expect, test, type Page } from "@playwright/test";

const PROVIDER_URL = "https://open.bigmodel.cn/api/anthropic/v1/messages";

/** anthropic SSE 流（单样本 complete 形状） */
function sseBody(): string {
  return [
    'event: message_start',
    'data: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":1}}}',
    '',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
    '',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}',
    '',
    'event: message_delta',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":12,"output_tokens":48}}',
    '',
    'event: message_stop',
    'data: {"type":"message_stop"}',
    '',
  ].join("\n");
}

async function fillForm(page: Page, opts: { samples?: string } = {}) {
  await page.getByLabel("Request URL（完整请求地址）").fill(PROVIDER_URL);
  await page.getByLabel("Model").fill("glm-5.3");
  await page.getByLabel("API Key", { exact: false }).fill("sk-e2e-test");
  if (opts.samples) {
    await page.getByLabel("取样").selectOption(opts.samples);
  }
}

test.describe("transport consent", () => {
  test("默认 browser-direct，提交后直接请求 provider，不经过代理", async ({ page }) => {
    const providerHits: string[] = [];
    const proxyHits: string[] = [];
    await page.route("**/v1/messages", (route) => {
      providerHits.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody(),
      });
    });
    await page.route("**/api/bench", (route) => {
      proxyHits.push(route.request().url());
      return route.fulfill({ status: 200, json: {} });
    });

    await page.goto("/");
    await fillForm(page);
    await page.getByRole("button", { name: "开始测速" }).click();

    // 默认走浏览器直连：provider 命中、代理 0 次
    await expect(page.getByTestId("result-card")).toBeVisible({ timeout: 15_000 });
    expect(providerHits.length).toBe(1);
    expect(proxyHits.length).toBe(0);
  });

  test("选择项目代理：先出现 consent 确认，拒绝则不发出任何请求", async ({ page }) => {
    const proxyHits: string[] = [];
    await page.route("**/api/bench", (route) => {
      proxyHits.push(route.request().url());
      return route.fulfill({ status: 200, json: {} });
    });

    await page.goto("/");
    await fillForm(page);
    await page.getByRole("radio", { name: /中转代理/ }).check();
    await page.getByRole("button", { name: "开始测速" }).click();

    // consent 面板出现，文案包含「不存盘」的实质说明
    const consent = page.getByTestId("proxy-consent");
    await expect(consent).toBeVisible();
    await expect(consent).toContainText("不存盘");

    await page.getByRole("button", { name: "取消" }).click();
    await expect(consent).toBeHidden();
    expect(proxyHits.length).toBe(0);
  });

  test("同意后：恰好一次代理请求，结果标记 trusted-proxy", async ({ page }) => {
    const proxyHits: string[] = [];
    await page.route("**/api/bench", (route) => {
      proxyHits.push(route.request().url());
      return route.fulfill({
        status: 200,
        json: {
          schemaVersion: 2,
          measurementVersion: 1,
          profile: { id: "cpb-standard", version: 1, promptSha256: "x" },
          transport: "trusted-proxy",
          status: "complete",
          requestedSamples: 1,
          successCount: 1,
          aggregate: {
            ttftMs: 120, thinkingMs: null, generationMs: 800, totalMs: 1000,
            outputTokens: 60, inputTokens: 12, tps: 75, tokenSource: "provider",
          },
          samples: [],
        },
      });
    });

    await page.goto("/");
    await fillForm(page);
    await page.getByRole("radio", { name: /中转代理/ }).check();
    await page.getByRole("button", { name: "开始测速" }).click();
    await page.getByTestId("proxy-consent").getByRole("button", { name: /同意/ }).click();

    await expect(page.getByTestId("result-card")).toBeVisible({ timeout: 15_000 });
    expect(proxyHits.length).toBe(1);
    await expect(page.getByTestId("result-transport")).toContainText("中转代理");
  });
});

test.describe("progress and cancel", () => {
  test("多样本显示样本进度并允许取消", async ({ page }) => {
    let providerHits = 0;
    await page.route("**/v1/messages", async (route) => {
      providerHits += 1;
      // 每个样本流式返回前挂起 800ms，给取消留时间窗
      await new Promise((r) => setTimeout(r, 800));
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody(),
      });
    });

    await page.goto("/");
    await fillForm(page, { samples: "3" });
    await page.getByRole("button", { name: "开始测速" }).click();

    const progress = page.getByTestId("run-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toContainText("1/3");

    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByTestId("result-card")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("result-status")).toContainText("已取消");
    expect(providerHits).toBeLessThan(3);
  });
});
