import { expect, test } from "@playwright/test";

test("學生從首頁完成閱讀、文證、修正與建城", async ({ page }) => {
  const contributions = [];
  await page.addInitScript(() => {
    localStorage.setItem("reading-expedition.class-token", "a".repeat(43));
  });
  await page.route("**/api/v1/classrooms/contribute", async (route) => {
    contributions.push({
      authorization: route.request().headers().authorization,
      body: route.request().postDataJSON(),
    });
    await route.fulfill({ status: 202, body: "" });
  });
  await page.goto("/");

  const worldCard = page.getByRole("article").filter({ hasText: "四海航線" });
  await worldCard.getByRole("button", { name: /行舟卷/ }).click();
  await expect(
    page.getByRole("heading", { name: "一座城市如何分配有限水源？" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "前往 3 題問答" }).click();
  await page
    .getByRole("radio", { name: "只看誰要求得最多" })
    .check();
  await page.getByRole("button", { name: "下一題" }).click();
  await page
    .getByRole("radio", {
      name: "不同用途的基本需要與缺水影響可能不同",
    })
    .check();
  await page.getByRole("button", { name: "下一題" }).click();
  await page.getByRole("radio", { name: "第4段" }).check();
  await page.getByRole("button", { name: "送出 3 題" }).click();
  await expect(
    page.getByRole("button", { name: "查看第3段線索" }),
  ).toBeVisible();

  await page
    .getByRole("radio", { name: "基本需要、影響與節水能力" })
    .check();
  await page.getByRole("button", { name: "完成修正" }).click();
  await page.getByRole("button", { name: "把知識帶回浮城" }).click();
  await expect.poll(() => contributions.length).toBe(1);
  expect(contributions[0]).toMatchObject({
    authorization: `Bearer ${"a".repeat(43)}`,
    body: {
      validReading: true,
      contentId: "water-sharing-guided-v1",
      category: "world",
      skill: "evidence",
    },
  });

  await page
    .getByRole("button", { name: /投入天下驛站/ })
    .click();
  await expect(page.getByText("天下驛站升到第 1 階")).toBeVisible();

  await page.reload();
  await expect(page.getByText("天下驛站・第 1 階")).toBeVisible();
});
