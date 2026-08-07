import { expect, test } from "./fixtures.js";

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

test("每位閱行者進入時先看到個人備份提醒", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "替此裝置的閱行者留一份個人備份" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "立即下載個人備份" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "這次先不備份，開始閱讀" })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "替此裝置的閱行者留一份個人備份" }),
  ).toHaveCount(0);
});

test("首頁只顯示一篇個人挑戰並可直接開始", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "一次一篇，讀懂再往前" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);

  const nextCard = page.getByRole("article");
  await expect(nextCard).toContainText("啟航");
  await expect(nextCard).toContainText("引導模式");
  await expect(nextCard).toContainText("未讀");

  await nextCard.getByRole("button", { name: /引導模式/ }).click();
  await expect(page).toHaveURL(/#\/read\/[a-zA-Z0-9-]+$/);
});

test("正式庫存 API 尚無文章時仍提供內建啟航讀卷", async ({ page }) => {
  await page.route("**/api/v1/readings?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        readings: [],
        pagination: { page: 1, pageSize: 200, total: 0, hasMore: false },
      }),
    });
  });

  await page.goto("/");
  await expect(page.locator(".route-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /啟航.*引導模式/ }).first(),
  ).toBeVisible();
});

test("手機首頁為單欄且主要內容沒有水平捲動", async ({ page }) => {
  await page.goto("/");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("夜讀模式返回或重載首頁時，標題與航線仍有足夠對比", async ({
  page,
}) => {
  await page.goto("/#/read/water-sharing-guided-v1");
  await expect(page.locator(".reading-controls")).toBeVisible();
  const nightButton = page.getByRole("button", { name: "夜讀" });
  if (!(await nightButton.isVisible())) {
    await page.getByRole("button", { name: "顯示設定" }).click();
  }
  await expect(nightButton).toBeVisible();
  await nightButton.click();
  await page.getByRole("link", { name: "返回個人挑戰" }).click();

  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-mode",
    "night",
  );
  await expect
    .poll(() =>
      contrastRatio(
        page.getByRole("heading", { name: "一次一篇，讀懂再往前" }),
      ),
    )
    .toBeGreaterThanOrEqual(4.5);
  await expect
    .poll(() =>
      contrastRatio(
        page.locator(".route-card h2"),
      ),
    )
    .toBeGreaterThanOrEqual(4.5);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-mode",
    "night",
  );
});

test("書架看得到庫存中的30個主題，不只當日三題", async ({ page }) => {
  const readings = Array.from({ length: 30 }, (_, index) => {
    const first = index === 0;
    return {
      id: first ? "old-photo-launch-v1" : `inventory-${index}-guided`,
      contentKey: first ? "level-launch-old-photo" : `inventory-${index}`,
      category: ["world", "science", "humanities"][index % 3],
      difficulty: "guided",
      level: "launch",
      supportMode: "guided",
      textType: "vernacular",
      title: first ? "舊照片沒有說完的故事" : `庫存讀卷 ${index + 1}`,
      hookQuestion: "這份讀卷帶來什麼線索？",
      readingMinutes: 5,
      version: 1,
    };
  });
  await page.route("**/api/v1/readings?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        readings,
        pagination: { page: 1, pageSize: 200, total: 30, hasMore: false },
      }),
    });
  });

  await page.goto("/#/bookshelf");
  await expect(page.getByRole("heading", { name: "選文書架" })).toBeVisible();
  await expect(page.getByText("啟航・已完成 0 / 30")).toBeVisible();
  await expect(page.locator(".bookshelf-card")).toHaveCount(30);
});

test("唯一啟航讀卷完成後顯示等待下一批，浮城進度不歸零", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const key = "reading-expedition:v1";
    const state = JSON.parse(localStorage.getItem(key));
    state.completedReadings["old-photo-launch-v1"] = {
      date: "2026-08-06",
    };
    state.city.materials.inkBricks = 7;
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "這一批已讀完，且在浮城歇一歇" }),
  ).toBeVisible();
  await expect(page.getByText(/不會歸零/)).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("reading-expedition:v1")).city
          .materials.inkBricks,
    ),
  ).toBe(7);
});
