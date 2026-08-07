import { expect, test } from "./fixtures.js";

test("學生從首頁完成閱讀、達標與建城", async ({ page }) => {
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

  await page.goto("/#/read/water-sharing-guided-v1");
  await expect(
    page.getByRole("heading", { name: "一座城市如何分配有限水源？" }),
  ).toBeVisible();

  await page.locator(".reading-paragraph").last().scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "前往 3 題問答" })).toBeEnabled();
  await page.getByRole("button", { name: "前往 3 題問答" }).click();
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
  await expect(page.getByText("答題達標，這一篇讀懂了")).toBeVisible();
  await page.getByRole("button", { name: "查看成果與下一步" }).click();
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
  await expect(
    page.getByRole("heading", { name: "下一步，由你決定" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "今天先到這裡，明天再來" }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText("天下驛站・第 1 階")).toBeVisible();
});
