// T-009 视觉回归 e2e（AC-010）：紧凑工作台层级 snapshots。
// 统一在 reduced-motion 下截图（CSS 动画停 + App useReducedMotion 停 JS 循环），
// 保证跨机确定性。UI 已收敛 Swiss Industrial Print 单浅色主题（dark 已移除），
// colorScheme 固定 emulate light 以屏蔽宿主机系统偏好差异。
import { expect, test, type Page } from "@playwright/test";

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(700); // 等待入场动画结束（reduced 下瞬时）
}

test.describe("visual", () => {
  test("1440px light：测速工作台信息层级", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await settle(page);
    await expect(page).toHaveScreenshot("workbench-1440-light.png", {
      fullPage: false,
    });
  });

  test("375px light：移动端紧凑布局", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await settle(page);
    await expect(page).toHaveScreenshot("workbench-375-light.png", {
      fullPage: false,
    });
  });

  test("1440px reduced-motion：无背景循环调度（快照稳定）", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/");
    await settle(page);
    // 连续两次截图像素一致 → 证明无持续变化的 JS/CSS 动画（容差走 config 0.08）
    await expect(page).toHaveScreenshot("workbench-1440-reduce.png");
    await page.waitForTimeout(1200);
    await expect(page).toHaveScreenshot("workbench-1440-reduce.png");
  });
});
