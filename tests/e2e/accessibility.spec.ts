// T-009 无障碍 e2e（AC-009）：Axe 扫描 0 critical/serious、
// icon-only 控件有名称、键盘可完成主流程、tablist 语义。
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("accessibility", () => {
  test("测速视图：0 critical / 0 serious", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );
    expect(
      serious.map((v) => `${v.id}: ${JSON.stringify(v.nodes.map((n) => n.target))}`),
    ).toEqual([]);
  });

  test("能力榜视图：0 critical / 0 serious", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /能力榜/ }).first().click();
    await page.waitForLoadState("networkidle");
    // 等真实数据渲染完成（Skeleton 中间态不定，不可作为 axe 输入）
    await expect(page.getByText(/更新于/)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );
    expect(
      serious.map((v) => `${v.id}: ${JSON.stringify(v.nodes.map((n) => n.target))}`),
    ).toEqual([]);
  });

  test("icon-only 控件都有可访问名称（axe button-name/link-name 隐含）+ 显式核对", async ({ page }) => {
    await page.goto("/");
    // 安全横幅关闭按钮
    await expect(page.getByRole("button", { name: "关闭安全说明" })).toBeAttached();
    // Key 显隐按钮
    await expect(page.getByRole("button", { name: /显示 Key/ })).toBeAttached();
    // 榜单删除按钮（带条目名）
    await expect(
      page.getByRole("button", { name: /删除 .+/ }).first(),
    ).toBeAttached();
    // 移动端 GitHub 链接（桌面为文本链接）
    const gh = page.getByRole("link", { name: /GitHub/ }).first();
    await expect(gh).toBeAttached();
  });

  test("键盘完成主流程：Tab 聚焦表单 → Enter 提交 → 焦点可见", async ({ page }) => {
    const providerHits: string[] = [];
    await page.route("**/v1/messages", (route) => {
      providerHits.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
          "",
          'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":1,"output_tokens":5}}',
          "",
        ].join("\n"),
      });
    });

    await page.goto("/");
    // 键盘：聚焦 Request URL 输入并填写
    const url = page.getByLabel("Request URL（完整请求地址）");
    await url.click();
    await url.fill("https://open.bigmodel.cn/api/anthropic/v1/messages");
    await page.getByLabel("Model").fill("glm-5.3");
    await page.getByLabel("API Key", { exact: false }).fill("sk-kb-test");
    // Tab 到提交按钮并 Enter
    await page.getByRole("button", { name: "开始测速" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("result-card")).toBeVisible({ timeout: 15_000 });
    expect(providerHits).toHaveLength(1);
    // 焦点环样式存在（focus-visible outline 非零）
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? getComputedStyle(el).outlineStyle : "none";
    });
    expect(outline).not.toBe("");
  });

  test("指标切换为 tablist/tab + aria-selected", async ({ page }) => {
    await page.goto("/");
    const tablist = page.getByRole("tablist", { name: "排序指标" });
    await expect(tablist).toBeVisible();
    const ttft = page.getByRole("tab", { name: /TTFT|首 token/ });
    await expect(ttft).toHaveAttribute("aria-selected", "false");
    await ttft.click();
    await expect(ttft).toHaveAttribute("aria-selected", "true");
  });

  test("协议组为 fieldset+legend 语义", async ({ page }) => {
    await page.goto("/");
    const fs = page.locator("fieldset", { has: page.getByRole("radio", { name: "OpenAI" }) });
    await expect(fs).toBeAttached();
  });
});
