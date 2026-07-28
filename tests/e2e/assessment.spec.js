import { expect, test } from "@playwright/test";

test("答錯會定位原文，學生可修正一次後帶回文證", async ({ page }) => {
  await page.goto("/#/quiz/water-sharing-guided-v1");

  await expect(
    page.getByRole("heading", { name: "用 3 題確認你讀懂了什麼" }),
  ).toBeVisible();

  await page
    .getByRole("radio", { name: "以各方目前申報的用水量作為主要依據" })
    .check();
  await page.getByRole("button", { name: "下一題" }).click();
  await page
    .getByRole("radio", {
      name: "不同用途的基本需要與缺水影響可能不同",
    })
    .check();
  await page.getByRole("button", { name: "下一題" }).click();
  await page
    .getByRole("radio", {
      name: "當水情、需求或節水成果改變，原先的比例也應重新檢討",
    })
    .check();
  await page.getByRole("button", { name: "送出 3 題" }).click();

  await expect(
    page.getByRole("button", { name: "查看第3段線索" }),
  ).toBeVisible();
  await expect(
    page.getByText("尚有 1 題可以回看文章後修正一次"),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看第3段線索" }).click();
  await expect(page.getByRole("heading", { name: "第 3 段" })).toBeVisible();
  await expect(page).toHaveURL(/#\/quiz\/water-sharing-guided-v1$/);
  await page.getByRole("button", { name: "回到題目" }).click();

  await page
    .getByRole("radio", { name: "基本需要、影響與節水能力" })
    .check();
  await page.getByRole("button", { name: "完成修正" }).click();

  await expect(page.getByText("文證已帶回")).toBeVisible();
  await page.getByRole("button", { name: "把知識帶回浮城" }).click();
  await expect(page).toHaveURL(/#\/city\/invest\/water-sharing-guided-v1$/);
});

test("多題答錯時可逐題修正，文證只突出精準片段", async ({ page }) => {
  await page.goto("/#/quiz/water-sharing-guided-v1");

  await page
    .getByRole("radio", { name: "以各方目前申報的用水量作為主要依據" })
    .check();
  await page.getByRole("button", { name: "下一題" }).click();
  await page
    .getByRole("radio", { name: "採用相同比例，便能確保三方承受相近影響" })
    .check();
  await page.getByRole("button", { name: "下一題" }).click();
  await page
    .getByRole("radio", { name: "家庭、農田與工廠卻仍然同時需要用水" })
    .check();
  await page.getByRole("button", { name: "送出 3 題" }).click();

  await expect(
    page.getByText("尚有 3 題可以回看文章後修正一次"),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看第3段線索" }).click();
  await expect(page.locator(".evidence-drawer mark")).not.toBeEmpty();
  await page.getByRole("button", { name: "回到題目" }).click();

  await page
    .getByRole("radio", { name: "基本需要、影響與節水能力" })
    .check();
  await page.getByRole("button", { name: "下一題" }).click();
  await page
    .getByRole("radio", {
      name: "不同用途的基本需要與缺水影響可能不同",
    })
    .check();
  await page.getByRole("button", { name: "下一題" }).click();
  await page
    .getByRole("radio", {
      name: "當水情、需求或節水成果改變，原先的比例也應重新檢討",
    })
    .check();
  await page.getByRole("button", { name: "完成修正" }).click();

  await expect(page.getByText("文證已帶回")).toBeVisible();
});
