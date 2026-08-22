import { expect, test } from "./fixtures.js";

test.use({ serviceWorkers: "block" });

test("學生以班級碼匿名加入，只看到共同地標", async ({ page }) => {
  let votePayload = null;
  let exitPayload = null;
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
        nextLevelAt: 30,
        remainingToNextLevel: 4,
        weeklyPeriod: "2026-W34",
        weeklyValidReadings: 6,
        weeklyMissionTarget: 10,
        mission: { type: "shared_readings", target: 10 },
        currentAssignment: {
          readingId: "old-photo-launch-v1",
          title: "舊照片沒有說完的故事",
          ability: "evidence",
          route: "guided",
          dueDate: null,
        },
      }),
    });
  });
  await page.route("**/api/v1/classrooms/vote", async (route) => {
    votePayload = route.request().postDataJSON();
    await route.fulfill({ status: 202, body: "{}" });
  });
  await page.route("**/api/v1/classrooms/exit", async (route) => {
    exitPayload = route.request().postDataJSON();
    await route.fulfill({ status: 202, body: "{}" });
  });

  await page.goto("/#/class");
  await expect(page.getByRole("heading", { name: "加入班級" })).toBeVisible();
  await expect(page.getByText("請輸入老師提供的 8 碼班級碼")).toBeVisible();
  await page.getByLabel("8 碼班級碼").fill("ABCD-EFG2");
  await page.getByRole("button", { name: "加入班級" }).click();

  await expect(page.getByRole("heading", { name: "班級共同地標" })).toBeVisible();
  await expect(page.getByText("第 2 階")).toBeVisible();
  await expect(page.locator(".class-mission > .eyebrow")).toContainText(
    "共同篇數",
  );
  await expect(page.getByText(/全班本週再完成 4 次有效閱讀/)).toBeVisible();
  await expect(page.getByText(/有效閱讀定義/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "舊照片沒有說完的故事" })).toBeVisible();
  await expect(page.getByRole("link", { name: "開啟指派閱讀" })).toHaveAttribute(
    "href",
    "#/read/old-photo-launch-v1",
  );
  await expect(page.getByText(/片段完全隱藏/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "匿名投票結果" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "匿名觀點牆" })).toHaveCount(0);
  await expect(page.getByText(/沒有排行榜、個人貢獻、姓名/)).toBeVisible();
  await expect(page.getByText(/小明|第一名/)).toHaveCount(0);
  await page.getByRole("link", { name: "開啟 16:9 投影頁" }).click();
  await expect(page.locator(".class-shell")).toHaveClass(/is-projecting/);
  await expect(page.locator(".class-shell")).toHaveCSS("aspect-ratio", "16 / 9");
  await page.getByRole("link", { name: "離開投影模式" }).click();

  await page.getByRole("button", { name: "類別平衡" }).click();
  await expect(page.getByText(/已送出「類別平衡」/)).toBeVisible();
  expect(votePayload).toEqual({ choice: "category_balance" });
  await page
    .getByRole("button", { name: "我找到可支持判斷的文證" })
    .click();
  await expect(page.getByText(/已匿名送出/)).toBeVisible();
  expect(exitPayload).toEqual({ code: "found_evidence" });
});

test("隱私門檻後才顯示班級拼圖，減少動態時不播放達標動畫", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("reading-expedition.class-token", "token-for-class");
  });
  await page.route("**/api/v1/classrooms/landmark", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        privacyProtected: false,
        participantThreshold: 5,
        anonymousParticipants: 8,
        validReadings: 30,
        landmarkLevel: 3,
        weeklyPeriod: "2026-W34",
        weeklyValidReadings: 10,
        weeklyMissionTarget: 10,
        mission: { type: "category_balance", target: 10 },
        categoryDistribution: { world: 3, science: 4, humanities: 3 },
        skillDistribution: { comprehension: 4, inference: 2, evidence: 4 },
        voteDistribution: {
          shared_readings: 4,
          category_balance: 3,
          ability_practice: 1,
        },
        exitDistribution: {
          found_evidence: 5,
          changed_view: 2,
          need_support: 1,
        },
      }),
    });
  });

  await page.goto("/#/class");
  await expect(page.getByRole("heading", { name: "拼圖閱讀" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "匿名投票結果" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "匿名觀點牆" })).toBeVisible();
  await expect(page.getByText("自然科學片段")).toBeVisible();
  await expect(page.locator("[data-mission-complete]")).not.toHaveClass(
    /is-celebrating/,
  );
});

test("匿名結束單失敗時保留選擇供重試且不清除共同進度", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("reading-expedition.class-token", "retry-token");
  });
  await page.route("**/api/v1/classrooms/landmark", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        privacyProtected: true,
        participantThreshold: 5,
        landmarkLevel: 1,
        weeklyPeriod: "2026-W34",
        weeklyValidReadings: 2,
        weeklyMissionTarget: 10,
      }),
    });
  });
  await page.route("**/api/v1/classrooms/exit", async (route) => {
    await route.fulfill({ status: 503, body: "{}" });
  });

  await page.goto("/#/class");
  const choice = page.getByRole("button", {
    name: "我還需要一個提示或例子",
  });
  await choice.click();

  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/保留選擇，可以稍後重試/)).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "2",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("reading-expedition.class-token"),
    ),
  ).toBe("retry-token");
});

test("班級 landmark 暫時 5xx 時保留匿名席次與離線共建佇列", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("reading-expedition.class-token", "x".repeat(43));
    localStorage.setItem(
      "reading-expedition.class-contributions.v1",
      JSON.stringify([{ pending: true }]),
    );
  });
  await page.route("**/api/v1/classrooms/landmark", async (route) => {
    await route.fulfill({ status: 503, body: "{}" });
  });
  await page.goto("/#/class");
  await expect(page.getByRole("heading", { name: "班級連線暫時中斷" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("reading-expedition.class-token"))).toBe("x".repeat(43));
  expect(await page.evaluate(() => localStorage.getItem("reading-expedition.class-contributions.v1"))).not.toBeNull();
});

test("共同達標動畫同一匿名任務只播放一次", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("reading-expedition.class-token", "celebration-token");
  });
  await page.route("**/api/v1/classrooms/landmark", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        privacyProtected: true,
        participantThreshold: 5,
        landmarkLevel: 2,
        weeklyPeriod: "2026-W34",
        weeklyValidReadings: 10,
        weeklyMissionTarget: 10,
        mission: { type: "shared_readings", target: 10 },
      }),
    });
  });

  await page.goto("/#/class");
  await expect(page.locator("[data-mission-complete]")).toHaveClass(
    /is-celebrating/,
  );
  await page.reload();
  await expect(page.locator("[data-mission-complete]")).not.toHaveClass(
    /is-celebrating/,
  );
  await expect(page.getByText(/共同達標・每一片文證/)).toBeVisible();
});

test("班級碼錯誤時保留輸入，加入後可離開並更換班級", async ({ page }) => {
  await page.route("**/api/v1/classrooms/join", async (route) => {
    await route.fulfill({ status: 404, body: "{}" });
  });

  await page.goto("/#/class");
  const input = page.getByLabel("8 碼班級碼");
  await input.fill("abcd efg2");
  await page.getByRole("button", { name: "加入班級" }).click();

  await expect(input).toHaveValue("ABCDEFG2");
  await expect(input).toBeFocused();
  await expect(page.locator("[data-class-join-message]")).toContainText(
    "班級碼無效或已到期",
  );
});

test("教師分享的匿名深連結會預填班級碼且不含姓名", async ({ page }) => {
  await page.goto("/#/class?code=ABC23456");

  await expect(page.getByRole("heading", { name: "加入班級" })).toBeVisible();
  await expect(page.getByLabel("8 碼班級碼")).toHaveValue("ABC23456");
  expect(page.url()).not.toMatch(/name=|student=|teacher=/i);
});
