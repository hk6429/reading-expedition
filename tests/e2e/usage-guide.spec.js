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
