import { expect, test } from "./fixtures.js";

test("手機可完成一篇短文三題測讀，結果只推薦不鎖級", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/placement");

  await expect(
    page.getByRole("heading", { name: "一間把安靜借出去的圖書館" }),
  ).toBeVisible();
  await expect(page.locator(".placement-form fieldset")).toHaveCount(3);
  for (const fieldset of await page.locator(".placement-form fieldset").all()) {
    await fieldset.locator('input[type="radio"]').first().check();
  }
  await page.getByRole("button", { name: "看看建議起點" }).click();

  await expect(page.getByText("建議起點", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /啟航開始|行舟開始|登樓開始/ }),
  ).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("家庭護照預設先匿名試讀，家長能看到非個資承諾", async ({
  page,
}) => {
  await page.route("**/api/v1/family/passports/current", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "unauthorized", message: "尚未登入" },
      }),
    });
  });
  await page.goto("/#/family");

  await expect(
    page.getByRole("heading", { name: "家庭護照", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("不登入也能完整閱讀")).toBeVisible();
  await expect(page.getByText(/只使用孩子代號/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "建立護照並綁定目前進度" }),
  ).toBeVisible();
});

test("家庭頁同時提供每位孩子與全家庭 CSV，先顯示週趨勢", async ({
  page,
}) => {
  const children = [
    { id: "child-a", alias: "小舟", stateVersion: 1 },
    { id: "child-b", alias: "小樓", stateVersion: 1 },
  ];
  await page.route("**/api/v1/family/passports/current", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        family: { id: "family-1", timeZone: "Asia/Taipei", children },
      }),
    });
  });
  await page.route("**/api/v1/family/children/*/state", async (route) => {
    const childId = route.request().url().includes("child-a")
      ? "child-a"
      : "child-b";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        state: {
          diagnosticHistory: [
            {
              readingId: "sample",
              title: "測試文章",
              date: new Intl.DateTimeFormat("en-CA").format(new Date()),
              level: "launch",
              supportMode: "guided",
              items: [
                {
                  type: "comprehension",
                  firstCorrect: true,
                  finalCorrect: true,
                  revised: false,
                  evidenceViewed: false,
                },
              ],
            },
          ],
          childId,
        },
      }),
    });
  });
  await page.goto("/#/family");

  await expect(
    page.getByRole("button", { name: "下載全家庭 CSV" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "下載孩子 CSV" }),
  ).toHaveCount(2);
  await expect(page.getByText(/本週 1 篇/)).toHaveCount(2);
  await expect(
    page.getByText("每位孩子，都有自己的浮城"),
  ).toBeVisible();
});
