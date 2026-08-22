import { expect, test } from "./fixtures.js";

test("完成三層素養題可獲得墨磚並讓城市立即成長", async ({ page }) => {
  await page.goto("/#/quiz/water-sharing-guided-v1");

  await page
    .getByRole("radio", { name: "基本需要、影響與節水能力" })
    .check();
  await page.getByRole("button", { name: "下一題" }).click();
  await page
    .getByRole("radio", {
      name: "不同用途的基本需要與缺水影響可能不同",
    })
    .check();
  await page.getByRole("button", { name: "下一題" }).click();
  await page
    .getByRole("radio", {
      name: "當水情、需求或節水成果改變，原先的比例也應重新檢討",
    })
    .check();
  await page
    .locator('[data-item-id="water-sharing-guided-q3-v1"] select')
    .selectOption("4");
  await page.getByRole("button", { name: "送出 3 題" }).click();
  await page.getByRole("button", { name: "查看成果與下一步" }).click();

  await expect(page.getByText("帶回 5 塊墨磚")).toBeVisible();
  await page
    .getByRole("button", { name: /投入聚義書樓/ })
    .click();

  await expect(page.getByText("聚義書樓升到第 1 階")).toBeVisible();
  await expect(page.getByText("燈火已點亮")).toBeVisible();

  await page.getByRole("link", { name: "看見整座浮城的變化" }).click();
  await expect(
    page.getByRole("heading", {
      name: "每一盞燈，都是我讀懂的證據",
    }),
  ).toBeVisible();
  await expect(
    page
      .locator(".reading-event-log")
      .getByText("一座城市如何分配有限水源？", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".reading-event-log q"),
  ).toContainText("當水情、需求或節水成果改變");
  await expect(
    page.locator(".equipment-card > div > strong"),
  ).toHaveText(["1／3", "1／3", "1／3"]);
  const equipment = page.getByLabel("我正在長出的三種能力");
  await expect(
    equipment.getByRole("heading", { name: "定錨腰牌" }),
  ).toBeVisible();
  await expect(
    equipment.getByRole("heading", { name: "連線羽扇" }),
  ).toBeVisible();
  await expect(
    equipment.getByRole("heading", { name: "文證放大鏡" }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText("聚義書樓")).toBeVisible();
  const city = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("reading-expedition:v1"));
    return {
      city: state.city,
      readingHistory: state.readingHistory,
      abilityGrowth: state.abilityGrowth,
    };
  });
  expect(city.city.buildings.library).toBe(1);
  expect(city.city.investments).toHaveLength(1);
  expect(city.readingHistory).toHaveLength(1);
  expect(city.abilityGrowth).toEqual({
    comprehension: 1,
    inference: 1,
    evidence: 1,
  });
});

test("只答對選項但未定位文證時不發主線獎勵", async ({ page }) => {
  await page.goto("/#/quiz/water-sharing-guided-v1");

  for (const [answer, action] of [
    ["基本需要、影響與節水能力", "下一題"],
    ["不同用途的基本需要與缺水影響可能不同", "下一題"],
    ["當水情、需求或節水成果改變，原先的比例也應重新檢討", "送出 3 題"],
  ]) {
    await page.getByRole("radio", { name: answer }).check();
    await page.getByRole("button", { name: action }).click();
  }
  await page.getByRole("button", { name: "查看成果與下一步" }).click();

  await expect(
    page.getByRole("heading", { name: "這篇還沒有收入閱讀事件簿" }),
  ).toBeVisible();
  await expect(page.locator(".building-grid")).toHaveCount(0);
  const progress = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("reading-expedition:v1"));
    return {
      inkBricks: state.city.materials.inkBricks,
      history: state.readingHistory,
      evidenceSubmitted:
        state.completedReadings["water-sharing-guided-v1"].evidenceSubmitted,
    };
  });
  expect(progress).toEqual({
    inkBricks: 0,
    history: [],
    evidenceSubmitted: false,
  });
});
