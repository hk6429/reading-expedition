import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("320、600、1024、1440px 不遮字且沒有主要水平捲動", async ({ page }) => {
  for (const width of [320, 600, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${width}px overflow`).toBeLessThanOrEqual(1);

    const copy = await page.locator(".hero-copy").boundingBox();
    const art = await page.locator(".hero-illustration").boundingBox();
    if (copy && art) {
      const intersects =
        copy.x < art.x + art.width &&
        copy.x + copy.width > art.x &&
        copy.y < art.y + art.height &&
        copy.y + copy.height > art.y;
      expect(intersects, `${width}px hero overlap`).toBe(false);
    }
  }
});

test("圖片缺失仍保留文字與安全色塊", async ({ page }) => {
  await page.route("**/*.{png,webp,jpg,jpeg}", (route) => route.abort());
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "四海航線" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "格物航線" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "眾生航線" })).toBeVisible();
});
