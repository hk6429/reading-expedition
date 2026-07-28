import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("學生以班級碼匿名加入，只看到共同地標", async ({ page }) => {
  await page.route("**/api/v1/classrooms/join", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        participantToken: "a".repeat(43),
        expiresAt: "2026-10-01T00:00:00Z",
      }),
    });
  });
  await page.route("**/api/v1/classrooms/landmark", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        privacyProtected: true,
        participantThreshold: 5,
        landmarkLevel: 2,
      }),
    });
  });

  await page.goto("/#/class");
  await page.getByLabel("八碼班級碼").fill("ABCDEFG2");
  await page.getByRole("button", { name: "加入共同地標" }).click();

  await expect(page.getByRole("heading", { name: "班級共同地標" })).toBeVisible();
  await expect(page.getByText("第 2 階")).toBeVisible();
  await expect(page.getByText(/沒有排行榜、個人貢獻、姓名/)).toBeVisible();
  await expect(page.getByText(/小明|第一名/)).toHaveCount(0);
});
