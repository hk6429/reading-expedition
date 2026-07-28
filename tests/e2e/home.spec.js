import { expect, test } from "@playwright/test";

test("首頁顯示三條航線並可在兩次點擊內開始文章", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "今天，想從哪裡讀懂世界？" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(3);

  const worldCard = page.getByRole("article").filter({ hasText: "四海航線" });
  await expect(worldCard).toContainText("行舟卷");
  await expect(worldCard).toContainText("登樓卷");

  await worldCard.getByRole("button", { name: /行舟卷/ }).click();
  await expect(page).toHaveURL(/#\/read\/water-sharing-guided-v1$/);
});

test("正式 API 當日尚無文章時仍提供安全示範讀卷", async ({ page }) => {
  await page.route("**/api/v1/daily", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ date: "2026-07-29", readings: [] }),
    });
  });

  await page.goto("/");
  await expect(page.locator(".route-card")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: /行舟卷/ }).first(),
  ).toBeVisible();
});

test("手機首頁為單欄且主要內容沒有水平捲動", async ({ page }) => {
  await page.goto("/");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("article")).toHaveCount(3);
});
