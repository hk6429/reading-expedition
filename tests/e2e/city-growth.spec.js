import { expect, test } from "@playwright/test";

test("完成兩題可獲得墨磚並讓城市立即成長", async ({ page }) => {
  await page.goto("/#/quiz/water-sharing-guided-v1");

  await page
    .getByRole("radio", { name: "基本需要、影響與節水能力" })
    .check();
  await page.getByRole("radio", { name: "第2段" }).check();
  await page.getByRole("button", { name: "送出兩題" }).click();
  await page.getByRole("button", { name: "把知識帶回浮城" }).click();

  await expect(page.getByText("帶回 5 塊墨磚")).toBeVisible();
  await page
    .getByRole("button", { name: /投入聚義書樓/ })
    .click();

  await expect(page.getByText("聚義書樓升到第 1 階")).toBeVisible();
  await expect(page.getByText("燈火已點亮")).toBeVisible();

  await page.reload();
  await expect(page.getByText("聚義書樓・第 1 階")).toBeVisible();
  const city = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("reading-expedition:v1"));
    return state.city;
  });
  expect(city.buildings.library).toBe(1);
  expect(city.investments).toHaveLength(1);
});
