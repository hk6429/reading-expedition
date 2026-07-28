import { expect, test } from "@playwright/test";

const viewports = [
  { name: "小手機直向", width: 320, height: 720 },
  { name: "手機直向", width: 390, height: 844 },
  { name: "小平板直向", width: 600, height: 960 },
  { name: "平板直向", width: 768, height: 1024 },
  { name: "平板橫向", width: 1024, height: 768 },
];

for (const viewport of viewports) {
  test(`${viewport.name}可單手選航線且點按區足夠`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const worldCard = page.locator(".route-card").filter({ hasText: "四海航線" });
    const action = worldCard.getByRole("button", { name: /行舟卷/ });
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    if (viewport.width <= 768) {
      const header = await page.locator(".site-header").boundingBox();
      expect(header.height).toBeLessThanOrEqual(112);
    }
    await action.click();
    await expect(page.getByRole("heading", { name: /一座城市如何分配有限水源/ })).toBeVisible();
  });
}

test("平板直向正文不會被三欄擠壓，手機工具列不遮住頁首", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/#/read/water-sharing-guided-v1");
  const tabletArticle = await page.locator(".reading-article").boundingBox();
  expect(tabletArticle.width).toBeGreaterThanOrEqual(448);
  const tabletControls = await page.locator(".reading-controls").boundingBox();
  expect(tabletControls.height).toBeLessThanOrEqual(88);

  await page.setViewportSize({ width: 320, height: 720 });
  await page.reload();
  const controls = await page.locator(".reading-controls").boundingBox();
  expect(controls.y).toBeGreaterThan(500);
});
