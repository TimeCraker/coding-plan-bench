// T-007 文案与 provenance e2e（AC-008）：
// - 无条件承诺（任意模型/Key 不上传/本机真实/终极判据）不得出现
// - transport 文案与实际执行位置一致；结果卡展示 provenance
import { expect, test } from "@playwright/test";

const PROVIDER_URL = "https://open.bigmodel.cn/api/anthropic/v1/messages";

function sseBody(): string {
  return [
    'data: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":1}}}',
    '',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
    '',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":12,"output_tokens":20}}',
    '',
    'data: {"type":"message_stop"}',
    '',
  ].join("\n");
}

test.describe("copy and provenance", () => {
  test("页面不出现无条件承诺文案", async ({ page }) => {
    await page.goto("/");
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("任意模型");
    expect(body).not.toContain("不上传");
    expect(body).not.toContain("本机当前真实表现");
    expect(body).not.toContain("终极判据");
  });

    test("transport 说明区解释了每种执行位置的 Key 路径", async ({ page }) => {
    await page.goto("/");
    const section = page.getByTestId("transport-selector");
    await expect(section).toBeVisible();
    await expect(section).toContainText("浏览器直连");
    await expect(section).toContainText("项目代理");
    // Key 路径实质说明（browser-direct：不经项目服务器）
    await expect(section).toContainText("不经项目服务器");
    // 页面提到本地版（tauri-local 的存在性与下载入口）
    await expect(page.locator("body")).toContainText("本地");
  });

    test("协议切换时 Request URL 示例是完整地址（不再拼接 /v1）", async ({ page }) => {
    await page.goto("/");
    const urlInput = page.getByLabel("Request URL（完整请求地址）");
    await expect(urlInput).toHaveAttribute(
      "placeholder",
      /https:\/\/[\S]+\/(v1\/messages|v1\/chat\/completions)/,
    );
    // 切到 OpenAI：placeholder 换成完整 chat/completions 地址
    await page.getByRole("radio", { name: "OpenAI" }).check();
    await expect(urlInput).toHaveAttribute(
      "placeholder",
      /\/v1\/chat\/completions/,
    );
    await page.getByRole("radio", { name: "Anthropic" }).check();
    await expect(urlInput).toHaveAttribute("placeholder", /\/v1\/messages/);
  });

    test("结果卡展示 transport/profile/完整性与 token 来源（provenance）", async ({ page }) => {
    await page.route("**/v1/messages", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody(),
      }),
    );
    await page.goto("/");
    await page.getByLabel("Request URL（完整请求地址）").fill(PROVIDER_URL);
    await page.getByLabel("Model").fill("glm-5.3");
    await page.getByLabel("API Key", { exact: false }).fill("sk-e2e-test");
    await page.getByRole("button", { name: "开始测速" }).click();

    const card = page.getByTestId("result-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("result-transport")).toContainText("浏览器直连");
    await expect(page.getByTestId("result-profile")).toContainText("cpb-standard");
    await expect(page.getByTestId("result-status")).toContainText("完整");
    await expect(page.getByTestId("result-samples")).toContainText("1/1");
    await expect(page.getByTestId("result-token-source")).toBeVisible();
    // Key 绝不出现在结果里
    const cardText = await card.innerText();
    expect(cardText).not.toContain("sk-e2e-test");
  });

    test("方法学说明存在且包含指标口径", async ({ page }) => {
    await page.goto("/");
    const method = page.getByTestId("methodology");
    await expect(method).toBeVisible();
    const text = await method.innerText();
    expect(text).toContain("TTFT");
    expect(text).toContain("TPS");
    // 术语码在方法学制式中大写渲染（TOTAL），锚语义不锚字形
    expect(text.toLowerCase()).toContain("total");
    expect(text).toContain("中位数");
  });
});
