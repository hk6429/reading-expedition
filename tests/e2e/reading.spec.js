import { expect, test } from "@playwright/test";

test("學生可閱讀行舟卷、調整夜讀並保存進度", async ({ page }) => {
  await page.goto("/#/read/water-sharing-guided-v1");

  await expect(
    page.getByRole("heading", { name: "一座城市如何分配有限水源？" }),
  ).toBeVisible();
  await expect(page.locator(".reading-paragraph")).toHaveCount(4);
  await expect(page.getByText("U.S. Geological Survey")).toBeVisible();

  await page.getByRole("button", { name: "夜讀" }).click();
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
