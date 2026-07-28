import { expect, test } from "@playwright/test";

test("手機可從頁首開啟師生使用說明並看見兩種操作流程", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "師生使用說明" }).click();

  await expect(
    page.getByRole("heading", { name: "師生怎麼使用梁山閱征記？" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "一篇、三題、一次修正" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "先校閱，再帶全班共讀" }),
  ).toBeVisible();
  await expect(page.getByText("答錯時回到原文找線索")).toBeVisible();
  await expect(page.getByText("不公開個人成績")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("學生可退出匿名統計且重新整理後維持設定", async ({ page }) => {
  await page.goto("/#/guide");
  const toggle = page.getByRole("checkbox", {
    name: "允許傳送匿名使用統計",
  });

  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.getByRole("status")).toContainText(
    "不會傳送匿名學習事件或載入到訪計數器",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("reading-expedition.anonymous-statistics"),
      ),
    )
    .toBe("off");

  await page.reload();
  await expect(toggle).not.toBeChecked();
  await expect(
    page.locator('script[src*="platform-counter.js"]'),
  ).toHaveCount(0);
});
