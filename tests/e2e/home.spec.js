import { expect, test } from "@playwright/test";

async function contrastRatio(locator) {
  return locator.evaluate((element) => {
    function rgb(value) {
      return value
        .match(/\d+(?:\.\d+)?/g)
        .slice(0, 3)
        .map(Number);
    }
    function luminance(value) {
      const channels = rgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return (
        0.2126 * channels[0] +
        0.7152 * channels[1] +
        0.0722 * channels[2]
      );
    }
    const style = getComputedStyle(element);
    const background = getComputedStyle(
      element.closest(".home-hero, .route-card"),
    ).backgroundColor;
    const light = Math.max(luminance(style.color), luminance(background));
    const dark = Math.min(luminance(style.color), luminance(background));
    return (light + 0.05) / (dark + 0.05);
  });
}

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

test("夜讀模式返回或重載首頁時，標題與航線仍有足夠對比", async ({
  page,
}) => {
  await page.goto("/#/read/water-sharing-guided-v1");
  const nightButton = page.getByRole("button", { name: "夜讀" });
  if (!(await nightButton.isVisible())) {
    await page.getByRole("button", { name: "顯示設定" }).click();
  }
  await nightButton.click();
  await page.getByRole("link", { name: "返回三條航線" }).click();

  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-mode",
    "night",
  );
  await expect
    .poll(() =>
      contrastRatio(
        page.getByRole("heading", { name: "今天，想從哪裡讀懂世界？" }),
      ),
    )
    .toBeGreaterThanOrEqual(4.5);
  await expect
    .poll(() =>
      contrastRatio(
        page.getByRole("heading", { name: "四海航線" }),
      ),
    )
    .toBeGreaterThanOrEqual(4.5);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-mode",
    "night",
  );
});
