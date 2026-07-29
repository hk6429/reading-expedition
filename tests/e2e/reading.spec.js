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

test("行舟卷用段落鷹架與就近詞語提示支援導讀", async ({ page }) => {
  await page.goto("/#/read/water-sharing-guided-v1");

  await expect(page.locator(".paragraph-scaffold")).toHaveCount(4);
  await expect(page.locator(".paragraph-scaffold").first()).toHaveText(
    "先看情境・1/4",
  );
  const termBlock = page.locator(".reading-block").filter({ hasText: "分配者" });
  await expect(termBlock.getByText("分配", { exact: true })).toBeVisible();
  await expect(termBlock.getByText("把有限資源依照規則分給不同對象。")).toBeHidden();
  await termBlock.getByText("分配", { exact: true }).click();
  await expect(termBlock.getByText("把有限資源依照規則分給不同對象。")).toBeVisible();

  await page.goto("/#/read/water-sharing-challenge-v1");
  await expect(page.locator(".paragraph-scaffold")).toHaveCount(0);
  const challengeTerm = page
    .locator(".reading-block")
    .filter({ hasText: "節水能力" })
    .first();
  await expect(
    challengeTerm.getByText("節水能力", { exact: true }),
  ).toBeVisible();
  await challengeTerm.getByText("節水能力", { exact: true }).click();
  await expect(
    challengeTerm.getByText("能否透過設備、流程或行為調整而減少用水。"),
  ).toBeVisible();
});

test("讀到一半時領航提示出現在學生當下閱讀位置", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/read/water-sharing-guided-v1");

  const checkpoint = page.locator(".midpoint-checkpoint");
  await expect(checkpoint).toBeHidden();
  await page.locator(".reading-block").nth(2).scrollIntoViewIfNeeded();
  await expect(checkpoint).toBeVisible();

  const box = await checkpoint.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await expect(checkpoint).toContainText("已走過一半");
});
