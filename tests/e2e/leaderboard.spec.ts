// T-008 榜单 e2e（AC-006）：comparable leaderboard。
// - demo 独立分区展示且不参与可比排名（不获得「最优」徽章）
// - complete 真实结果进入可比排名；partial 不入榜
// - v1 数据迁移为遗留分区（不可排名，原值保留）
// - 清空走稳定确认对话；删除可撤销
import { expect, test, type Page } from "@playwright/test";

const PROVIDER_URL = "https://open.bigmodel.cn/api/anthropic/v1/messages";

function sseBody(): string {
  return [
    'data: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":1}}}',
    '',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
    '',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":12,"output_tokens":48}}',
    '',
    'data: {"type":"message_stop"}',
    '',
  ].join("\n");
}

async function fillAndRun(page: Page, opts: { samples?: string } = {}) {
  await page.getByLabel("Request URL（完整请求地址）").fill(PROVIDER_URL);
  await page.getByLabel("Model").fill("glm-5.3");
  await page.getByLabel("API Key", { exact: false }).fill("sk-e2e-test");
  if (opts.samples) await page.getByLabel("取样").selectOption(opts.samples);
  await page.getByRole("button", { name: "开始测速" }).click();
}

test.describe("comparable leaderboard", () => {
  test("首次访问：示例数据独立分区，不参与可比排名", async ({ page }) => {
    await page.goto("/");
    const board = page.getByTestId("leaderboard");
    await expect(board).toBeVisible();
    // 示例分区标题明确
    await expect(board).toContainText("示例 · 不参与排名");
    // demo 行带示例徽章
    await expect(board.locator("[data-testid='remove-entry']").first()).toBeVisible();
    // 可比排名区为空提示
    await expect(board).toContainText("还没有可比较的记录");
  });

  test("complete 结果进入可比排名；partial 不入榜", async ({ page }) => {
    let call = 0;
    await page.route(PROVIDER_URL, (route) => {
      call += 1;
      if (call === 2) {
        // 3 样本中第 2 个失败 → partial
        return route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: 'event: message_stop\ndata: {"type":"message_stop"}\n\n',
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody(),
      });
    });

    await page.goto("/");
    await fillAndRun(page, { samples: "3" });
    await expect(page.getByTestId("result-card")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("result-status")).toContainText("部分成功");

    const board = page.getByTestId("leaderboard");
    // partial 不产生新的可比条目（仍只有示例）
    await expect(board.getByText("还没有可比较的记录")).toBeVisible();

    // 再跑一次单样本 complete → 进入可比排名
    await fillAndRun(page);
    await expect(page.getByTestId("result-status")).toContainText("完整", { timeout: 15_000 });
    await expect(board.getByText("可比 1 条")).toBeVisible({ timeout: 10_000 });
  });

  test("v1 localStorage 数据迁移为遗留分区（不可排名）", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "cpb:leaderboard",
        JSON.stringify([
          {
            id: "old-1",
            label: "智谱 GLM-5.2",
            endpoint: "https://open.bigmodel.cn/api/anthropic",
            model: "glm-5.2",
            protocol: "anthropic",
            ttft: 100,
            tps: 50,
            total: 2000,
            outputTokens: 90,
            samples: 3,
            ranAt: "2026-07-01T00:00:00.000Z",
          },
        ]),
      );
    });
    await page.goto("/");
    const board = page.getByTestId("leaderboard");
    await expect(board).toContainText("旧版记录");
    await expect(board).toContainText("智谱 GLM-5.2");
    await expect(board).toContainText("不可排名");
    // v1 备份已写入（幂等迁移证据）
    const backup = await page.evaluate(() => localStorage.getItem("cpb:leaderboard:v1-backup"));
    expect(backup).toContain("old-1");
    // v1 key 保留
    const v1 = await page.evaluate(() => localStorage.getItem("cpb:leaderboard"));
    expect(v1).toContain("old-1");
  });

  test("清空需要稳定确认：取消保留 / 确认清空", async ({ page }) => {
    await page.goto("/");
    const board = page.getByTestId("leaderboard");
    await expect(board).toContainText("示例 · 不参与排名");

    await page.getByTestId("clear-all").click();
    const no = page.getByTestId("confirm-clear-no");
    await expect(no).toBeVisible();
    await no.click();
    // 取消：数据仍在
    await expect(board).toContainText("示例 · 不参与排名");

    await page.getByTestId("clear-all").click();
    await page.getByTestId("confirm-clear-yes").click();
    // 确认：示例分区清空（榜单整体为空态）
    await expect(board).toContainText("还没有可比较的记录");
    await expect(board).not.toContainText("示例 · 不参与排名");
  });

  test("删除示例条目可撤销恢复", async ({ page }) => {
    await page.goto("/");
    const board = page.getByTestId("leaderboard");
    const before = await board.locator("[data-testid='remove-entry']").count();

    await board.locator("[data-testid='remove-entry']").first().click();
    const toast = page.getByTestId("undo-toast");
    await expect(toast).toBeVisible();

    await page.getByTestId("undo-button").click();
    await expect(toast).toBeHidden();
    await expect(board.locator("[data-testid='remove-entry']")).toHaveCount(before);
  });
});
