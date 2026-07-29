import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

function packageRecord(id, difficulty, title) {
  return {
    id,
    contentKey: "2026-07-28-world-water",
    category: "world",
    difficulty,
    textType: "vernacular",
    title,
    body: [{ id: "p1", text: "水資源需要兼顧基本需求與公平分配。" }],
    glossary: [],
    sourceAttribution: [
      {
        publisher: "公開資料站",
        url: "https://source.test/water",
        license: "CC BY",
      },
    ],
    facts: [{ claim: "安全用水是基本需要。", sourceItemId: "s1" }],
    assessment: [
      {
        id: `${id}-q1`,
        prompt: "哪句能支持答案？",
        correctAnswer: "水資源需要兼顧基本需求與公平分配。",
        rationale: "正文直接說明。",
        evidenceSpan: { paragraph: 1, start: 0, end: 17 },
      },
    ],
    qualityScore: 94,
    hardGateStatus: "passed",
    publicationStatus: "review",
    version: 2,
  };
}

test("教師登入後先看清單，點選後只載入單篇校閱內容", async ({ page }) => {
  const records = [
    packageRecord("water-guided", "guided", "一滴水的旅程"),
    packageRecord("water-challenge", "challenge", "城市如何分配水"),
  ];
  records[0].facts = [
    { statement: "安全用水是基本需要。", sourceItemId: "s1" },
  ];
  let published = false;
  const detailRequests = [];

  await page.route("**/api/v1/teacher/session", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "csrf-demo", expiresAt: "2026-07-29T00:00:00Z" }),
    });
  });
  await page.route("**/api/v1/teacher/review?status=review", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        packages: records.map(({ id, contentKey, difficulty, title, qualityScore }) => ({
          id,
          contentKey,
          difficulty,
          title,
          qualityScore,
        })),
      }),
    });
  });
  await page.route("**/api/v1/teacher/classrooms", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ classrooms: [] }),
    });
  });
  await page.route("**/api/v1/teacher/review/*/action", async (route) => {
    published = (await route.request().postDataJSON()).action === "published";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ package: records[0] }),
    });
  });
  await page.route("**/api/v1/teacher/review/*", async (route) => {
    const id = route.request().url().split("/").at(-1);
    detailRequests.push(id);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ package: records.find((record) => record.id === id) }),
    });
  });

  await page.goto("/#/teacher");
  await page.getByLabel("教師管理密鑰").fill("teacher-secret");
  await page.getByRole("button", { name: "進入校閱臺" }).click();

  await expect(page.getByRole("heading", { name: "今日待審讀卷" })).toBeVisible();
  await expect(page.locator(".review-list-item")).toHaveCount(2);
  await expect(page.locator(".review-detail")).toHaveCount(0);
  expect(detailRequests).toEqual([]);

  await page
    .getByRole("button", { name: "開啟審查：一滴水的旅程" })
    .click();
  await expect(page.locator(".review-detail")).toHaveCount(1);
  await expect(
    page.getByText("答案：水資源需要兼顧基本需求與公平分配。"),
  ).toHaveCount(1);
  await expect(page.getByText("安全用水是基本需要。")).toBeVisible();
  expect(detailRequests).toEqual(["water-guided"]);

  await page.locator(".review-detail").getByRole("button", { name: "桌面" }).click();
  await expect(page.locator(".student-preview--desktop")).toBeVisible();
  await page.locator(".review-detail").getByRole("button", { name: "核准發布" }).click();
  await expect(page.locator("[data-review-message]")).toContainText(
    "已建立發布紀錄",
  );
  expect(published).toBe(true);
});

test("待審為空時清楚說明，切換已發布後顯示正式文章", async ({
  page,
}) => {
  const publishedRecord = packageRecord(
    "water-published",
    "guided",
    "已發布的水源讀卷",
  );
  publishedRecord.publicationStatus = "published";

  await page.addInitScript(() => {
    sessionStorage.setItem("reading-expedition.csrf", "csrf-demo");
  });
  await page.route("**/api/v1/teacher/review?status=review", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ packages: [] }),
    });
  });
  await page.route(
    "**/api/v1/teacher/review?status=published",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          packages: [
            {
              id: publishedRecord.id,
              contentKey: publishedRecord.contentKey,
              difficulty: publishedRecord.difficulty,
              title: publishedRecord.title,
              qualityScore: publishedRecord.qualityScore,
            },
          ],
        }),
      });
    },
  );
  await page.route(
    "**/api/v1/teacher/review/water-published",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ package: publishedRecord }),
      });
    },
  );

  await page.goto("/#/teacher?status=review");
  await expect(page.getByText("目前沒有待審讀卷")).toBeVisible();
  await page.getByRole("link", { name: "查看已發布讀卷" }).click();

  await expect(page).toHaveURL(/#\/teacher\?status=published$/);
  await expect(
    page.getByRole("heading", { name: "已發布讀卷" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "開啟審查：已發布的水源讀卷" })
    .click();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "已發布的水源讀卷",
    }),
  ).toBeVisible();
});
