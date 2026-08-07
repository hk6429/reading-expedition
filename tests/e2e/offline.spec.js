import { expect, test } from "./fixtures.js";

test("首頁資產快取後可在離線狀態重新開啟並閱讀既有示範卷", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker?.controller);
  await page.reload();
  await context.setOffline(true);
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "一次一篇，讀懂再往前" }),
  ).toBeVisible();
  await page
    .getByRole("article")
    .getByRole("button", { name: /引導模式/ })
    .click();
  await expect(page.locator(".reading-header h1")).toBeVisible();
});
