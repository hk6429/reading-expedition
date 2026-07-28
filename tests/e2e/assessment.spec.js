import { expect, test } from "@playwright/test";

test("答錯會定位原文，學生可修正一次後帶回文證", async ({ page }) => {
  await page.goto("/#/quiz/water-sharing-guided-v1");

  await expect(
    page.getByRole("heading", { name: "帶回兩份文證" }),
  ).toBeVisible();

  await page
    .getByRole("radio", { name: "只看誰要求得最多" })
    .check();
  await page.getByRole("radio", { name: "第2段" }).check();
  await page.getByRole("button", { name: "送出兩題" }).click();

  await expect(page.getByText("再看第3段")).toBeVisible();
  await expect(page.getByText("第一題還可以修正一次")).toBeVisible();

  await page
    .getByRole("radio", { name: "基本需要、影響與節水能力" })
    .check();
  await page.getByRole("button", { name: "完成修正" }).click();

  await expect(page.getByText("文證已帶回")).toBeVisible();
  await page.getByRole("button", { name: "把知識帶回浮城" }).click();
  await expect(page).toHaveURL(/#\/city\/invest\/water-sharing-guided-v1$/);
});
