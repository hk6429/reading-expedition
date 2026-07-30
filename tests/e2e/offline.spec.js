import { expect, test } from "@playwright/test";

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
    page.getByRole("heading", { name: "今天，想從哪裡讀懂世界？" }),
  ).toBeVisible();
  const worldCard = page.getByRole("article").filter({ hasText: "四海航線" });
  await worldCard
    .getByRole("button", { name: /啟航.*引導模式/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "一座城市如何分配有限水源？" }),
  ).toBeVisible();
});
