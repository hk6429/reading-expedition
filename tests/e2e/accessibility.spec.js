import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("文字放大 200% 仍可操作，主要流程可用鍵盤啟動", async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

  const button = page
    .getByRole("article")
    .filter({ hasText: "四海航線" })
    .getByRole("button", { name: /啟航.*引導模式/ });
  await expect(button).toBeVisible();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/read\//);
});

test("reduced motion 生效且所有主要圖片有替代文字或裝飾標記", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const transition = await page.locator(".hero-illustration").evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(["0s", "0.00001s", "1e-05s"]).toContain(transition);
  await expect(page.locator(".hero-illustration img[alt]")).toHaveCount(1);
  await expect(page.locator(".route-art[alt='']")).toHaveCount(3);
});
