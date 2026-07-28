import { expect, test } from "@playwright/test";

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
  await page.getByRole("radio", { name: "第4段" }).check();
  await page.getByRole("button", { name: "送出 3 題" }).click();
  await page.getByRole("button", { name: "把知識帶回浮城" }).click();

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
    page.getByText("一座城市如何分配有限水源？", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("累積 1 點")).toHaveCount(3);

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
