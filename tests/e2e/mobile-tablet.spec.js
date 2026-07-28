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
    await action.click();
    await expect(page.getByRole("heading", { name: /一座城市如何分配有限水源/ })).toBeVisible();
  });
}
