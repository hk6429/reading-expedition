import { expect, test } from "@playwright/test";

test("學生從首頁完成閱讀、文證、修正與建城", async ({ page }) => {
  await page.goto("/");

  const worldCard = page.getByRole("article").filter({ hasText: "四海航線" });
  await worldCard.getByRole("button", { name: /行舟卷/ }).click();
  await expect(
    page.getByRole("heading", { name: "一座城市如何分配有限水源？" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "前往兩題問答" }).click();
  await page
    .getByRole("radio", { name: "只看誰要求得最多" })
    .check();
  await page.getByRole("radio", { name: "第2段" }).check();
  await page.getByRole("button", { name: "送出兩題" }).click();
  await expect(page.getByText("再看第3段")).toBeVisible();

  await page
    .getByRole("radio", { name: "基本需要、影響與節水能力" })
    .check();
  await page.getByRole("button", { name: "完成修正" }).click();
  await page.getByRole("button", { name: "把知識帶回浮城" }).click();

  await page
    .getByRole("button", { name: /投入天下驛站/ })
    .click();
  await expect(page.getByText("天下驛站升到第 1 階")).toBeVisible();

  await page.reload();
  await expect(page.getByText("天下驛站・第 1 階")).toBeVisible();
});
