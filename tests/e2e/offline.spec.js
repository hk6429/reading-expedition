import { expect, test } from "./fixtures.js";
import { levelReadingsById } from "../../src/data/level-readings.js";

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
    .locator(".route-card")
    .getByRole("button", { name: /引導模式/ })
    .click();
  await expect(page.locator(".reading-header h1")).toBeVisible();
});

test("正式讀卷可反覆離線與上線並立即更新作答狀態", async ({
  context,
  page,
}) => {
  const reading = structuredClone(levelReadingsById["old-photo-launch-v1"]);
  reading.id = "network-only-v1";
  reading.contentKey = "network-only-v1:1";
  await page.route("**/api/v1/readings/network-only-v1*", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ assessmentSession: "e2e-session" }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ reading }),
    });
  });

  await page.goto("/#/read/network-only-v1");
  await page.getByRole("button", { name: "我已讀到文末" }).click();
  const quiz = page.getByRole("button", { name: /前往 3 題問答/ });
  await expect(quiz).toBeEnabled();

  await context.setOffline(true);
  await expect(
    page.getByRole("button", { name: "恢復連線後才能作答" }),
  ).toBeDisabled();
  await context.setOffline(false);
  await expect(quiz).toBeEnabled();
  await context.setOffline(true);
  await expect(
    page.getByRole("button", { name: "恢復連線後才能作答" }),
  ).toBeDisabled();
  await context.setOffline(false);
});
