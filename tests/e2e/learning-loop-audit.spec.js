import { expect, test } from "./fixtures.js";

test("G034 來源雷達逐項顯示總數、發布者與資料類型", async ({ page }) => {
  await page.goto("/#/read/water-sharing-guided-v1");

  const radar = page.locator('[data-learning-feature="source-radar"]');
  await expect(radar).toContainText("來源共 1 筆");
  await expect(radar).toContainText("發布者：U.S. Geological Survey");
  await expect(radar).toContainText("資料類型：政府公開資料");
});

test("G048 未達標時逐題列出實際能力與文證段落檢查點", async ({ page }) => {
  await page.goto("/#/quiz/water-sharing-guided-v1");

  for (const [answer, action] of [
    ["以各方目前申報的用水量作為主要依據", "下一題"],
    ["採用相同比例，便能確保三方承受相近影響", "下一題"],
    ["家庭、農田與工廠卻仍然同時需要用水", "送出 3 題"],
    ["以各方目前申報的用水量作為主要依據", "下一題"],
    ["採用相同比例，便能確保三方承受相近影響", "下一題"],
    ["家庭、農田與工廠卻仍然同時需要用水", "完成修正"],
  ]) {
    await page.getByRole("radio", { name: answer }).check();
    await page.getByRole("button", { name: action }).click();
  }

  const checkpoints = page.locator(
    '[data-learning-feature="retry-checkpoint"] li',
  );
  await expect(checkpoints).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(checkpoints.nth(index)).toHaveText(
      /^(理解|推論|文證)・.+：回到第 \d+ 段，重新比對題目與原文線索。$/,
    );
  }
});
