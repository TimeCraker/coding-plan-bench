// T-009 响应式 e2e（AC-009）：375/768/1024/1440 无页面级横向滚动；
// 375 下操作常显（不依赖 hover）、触控目标 ≥44×44、指标控件可用。
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [
  { w: 375, h: 812, name: "375" },
  { w: 768, h: 1024, name: "768" },
  { w: 1024, h: 768, name: "1024" },
  { w: 1440, h: 900, name: "1440" },
];

async function assertNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

test.describe("responsive", () => {
  for (const { w, h, name } of WIDTHS) {
    test(`${name}px：无页面级横向滚动，核心区块可见`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await assertNoHorizontalScroll(page);
      await expect(page.getByTestId("transport-selector")).toBeVisible();
      await expect(page.getByLabel("Request URL（完整请求地址）")).toBeVisible();
      await expect(page.getByTestId("leaderboard")).toBeVisible();
    });
  }

  test("375px：删除按钮常显（无 hover 也可点）且触控区 ≥44×44", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const btn = page.getByTestId("remove-entry").first();
    await expect(btn).toBeVisible();
    // 计算样式 opacity 不为 0（不依赖 hover 显示）
    const opacity = await btn.evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).not.toBe("0");
    // 触控目标尺寸
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    // 直接点击成功（无 hover 前置）
    await btn.click();
    await expect(page.getByTestId("undo-toast")).toBeVisible();
  });

  test("375px：指标切换控件可见可点（不溢出屏幕）", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const tab = page.getByRole("tab", { name: "TPS" });
    // 可访问滚动：tab 可被滚动到并点击（物理 x 超屏在滚动容器内是合法的）
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    // 页面整体仍无横向滚动
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test("375px：表单与执行位置纵向堆叠仍可完成提交", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route("**/v1/messages", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
          "",
          'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":1,"output_tokens":5}}',
          "",
        ].join("\n"),
      }),
    );
    await page.goto("/");
    await page.getByLabel("Request URL（完整请求地址）").fill(
      "https://open.bigmodel.cn/api/anthropic/v1/messages",
    );
    await page.getByLabel("Model").fill("glm-5.3");
    await page.getByLabel("API Key", { exact: false }).fill("sk-m-test");
    await page.getByRole("button", { name: "开始测速" }).click();
    await expect(page.getByTestId("result-card")).toBeVisible({ timeout: 15_000 });
    await assertNoHorizontalScroll(page);
  });
});
