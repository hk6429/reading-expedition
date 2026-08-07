import { expect, test } from "./fixtures.js";

test("學生可閱讀啟航文章、調整夜讀並保存進度", async ({ page }) => {
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

  await page.locator(".reading-paragraph").last().scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "前往 3 題問答" })).toBeEnabled();
  await page.getByRole("button", { name: "前往 3 題問答" }).click();
  await expect(page).toHaveURL(/#\/quiz\/water-sharing-guided-v1$/);
});

test("從首頁深處開啟文章仍從標題開始", async ({ page }) => {
  await page.goto("/");
  const routeButton = page
    .getByRole("button", { name: /啟航.*引導模式/ })
    .first();
  await routeButton.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 500));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

  await routeButton.click();

  await expect(page).toHaveURL(/#\/read\/[a-zA-Z0-9-]+$/);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeLessThanOrEqual(4);
  await expect(page.locator(".reading-header h1")).toBeVisible();
  await expect(page.getByText("帶著這個問題讀")).toBeVisible();
});

test("引導模式提供段落路標，獨立模式保留點詞解釋", async ({ page }) => {
  await page.goto("/#/read/water-sharing-guided-v1");

  await expect(page.locator(".paragraph-scaffold")).toHaveCount(4);
  await expect(page.locator(".paragraph-scaffold").first()).toHaveText(
    "先看情境・1/4",
  );
  const termBlock = page.locator(".reading-block").filter({ hasText: "分配者" });
  await expect(termBlock.getByText("分配", { exact: true })).toBeVisible();
  await expect(
    termBlock.getByText("把有限資源依照規則分給不同對象。", {
      exact: true,
    }),
  ).toBeHidden();
  await termBlock.getByText("分配", { exact: true }).click();
  await expect(
    termBlock.getByText("把有限資源依照規則分給不同對象。", {
      exact: true,
    }),
  ).toBeVisible();

  await page.goto("/");
  await page
    .getByRole("button", { name: /獨立模式.*點詞解釋/ })
    .click();
  await expect(
    page.getByRole("button", { name: /獨立模式.*點詞解釋/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/#/read/water-sharing-guided-v1");
  await expect(page.locator(".paragraph-scaffold")).toHaveCount(0);
  const challengeTerm = page
    .locator(".reading-block")
    .filter({ hasText: "分配者" })
    .first();
  await expect(
    challengeTerm.getByText("分配", { exact: true }),
  ).toBeVisible();
  await challengeTerm.getByText("分配", { exact: true }).click();
  await expect(
    challengeTerm.getByText("把有限資源依照規則分給不同對象。", {
      exact: true,
    }),
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
