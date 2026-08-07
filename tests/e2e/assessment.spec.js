import { expect, test } from "./fixtures.js";

test("第一次答對兩題即達標，不強迫把第三題修到全對", async ({ page }) => {
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

  await expect(page.getByText("答題達標，這一篇讀懂了")).toBeVisible();
  await expect(page.getByText("你答對 2／3 題，閱讀與答題紀錄已保存。")).toBeVisible();
  await expect(page.getByRole("button", { name: /查看第.*段線索/ })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "答題達標，這一篇讀懂了" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "查看成果與下一步" }).click();
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

  await expect(page.getByText("答題達標，這一篇讀懂了")).toBeVisible();
});

test("手機作答時隱藏共用浮動元件且策略卡保持滿寬", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/#/quiz/water-sharing-guided-v1");
  await page.evaluate(() => {
    for (const id of ["danai-family-classroom", "danai-learning-passport"]) {
      if (document.getElementById(id)) continue;
      const host = document.createElement("div");
      host.id = id;
      document.body.append(host);
    }
  });

  await expect(page.locator("html")).toHaveAttribute(
    "data-focus-context",
    "assessment",
  );
  await expect(page.locator("#danai-family-classroom")).toBeHidden();
  await expect(page.locator("#danai-learning-passport")).toBeHidden();

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
  await page.getByRole("button", { name: "送出 3 題" }).click();

  const panel = page.locator(".reading-strategy-panel");
  await expect(panel).toBeVisible();
  const panelBox = await panel.boundingBox();
  const stepBox = await page.locator(".reading-strategy-steps li").first().boundingBox();
  expect(panelBox.width).toBeGreaterThanOrEqual(300);
  expect(stepBox.width).toBeGreaterThanOrEqual(260);
  await expect(
    page.getByRole("button", { name: "查看成果與下一步" }),
  ).toBeVisible();
});

test("未達門檻會保存作答，但不算完成也不開放下一篇", async ({ page }) => {
  await page.goto("/#/quiz/water-sharing-guided-v1");

  for (const [answer, action] of [
    ["以各方目前申報的用水量作為主要依據", "下一題"],
    ["採用相同比例，便能確保三方承受相近影響", "下一題"],
    ["家庭、農田與工廠卻仍然同時需要用水", "送出 3 題"],
  ]) {
    await page.getByRole("radio", { name: answer }).check();
    await page.getByRole("button", { name: action }).click();
  }

  for (const [answer, action] of [
    ["以各方目前申報的用水量作為主要依據", "下一題"],
    ["採用相同比例，便能確保三方承受相近影響", "下一題"],
    ["家庭、農田與工廠卻仍然同時需要用水", "完成修正"],
  ]) {
    await page.getByRole("radio", { name: answer }).check();
    await page.getByRole("button", { name: action }).click();
  }

  await expect(
    page.getByRole("heading", { name: "這一篇先停下來整理" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "回到文章，重新挑戰" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "今天先到這裡，明天再來" }),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("reading-expedition:v1")),
  );
  expect(state.completedReadings["water-sharing-guided-v1"]).toBeUndefined();
  expect(
    state.diagnosticHistory.some(
      ({ readingId }) => readingId === "water-sharing-guided-v1",
    ),
  ).toBe(true);
});
