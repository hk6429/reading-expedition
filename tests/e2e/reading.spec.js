import { expect, test } from "@playwright/test";

test("學生可閱讀行舟卷、調整夜讀並保存進度", async ({ page }) => {
  await page.goto("/#/read/water-sharing-guided-v1");

  await expect(
    page.getByRole("heading", { name: "一座城市如何分配有限水源？" }),
  ).toBeVisible();
  await expect(page.locator(".reading-paragraph")).toHaveCount(4);
  await expect(page.getByText("U.S. Geological Survey")).toBeVisible();

  const nightButton = page.getByRole("button", { name: "夜讀" });
  if (!(await nightButton.isVisible())) {
    await page.getByRole("button", { name: "顯示設定" }).click();
  }
  await nightButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-reading-mode", "night");

  await page.locator(".reading-paragraph").nth(2).scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("reading-expedition:v1");
        return raw ? JSON.parse(raw).readingProgress : {};
      }),
    )
    .toHaveProperty("water-sharing-guided-v1");

  await page.getByRole("button", { name: "前往 3 題問答" }).click();
  await expect(page).toHaveURL(/#\/quiz\/water-sharing-guided-v1$/);
});

test("從首頁深處開啟文章仍從標題開始", async ({ page }) => {
  await page.goto("/");
  const routeButton = page.getByRole("button", {
    name: /行舟卷.*一座城市如何分配有限水源/,
  }).first();
  await routeButton.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 500));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

  await routeButton.click();

  await expect(page).toHaveURL(/#\/read\/water-sharing-guided-v1$/);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeLessThanOrEqual(4);
  await expect(
    page.getByRole("heading", { name: "一座城市如何分配有限水源？" }),
  ).toBeVisible();
  await expect(page.getByText("帶著這個問題讀")).toBeVisible();
});
