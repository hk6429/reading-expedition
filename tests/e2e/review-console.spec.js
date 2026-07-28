import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

function packageRecord(id, difficulty, title) {
  return {
    id,
    contentKey: "2026-07-28-world-water",
    category: "world",
    difficulty,
    title,
    body: [{ id: "p1", text: "水資源需要兼顧基本需求與公平分配。" }],
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

test("教師登入後可並排校閱雙難度、切換預覽並發布", async ({ page }) => {
  const records = [
    packageRecord("water-guided", "guided", "一滴水的旅程"),
    packageRecord("water-challenge", "challenge", "城市如何分配水"),
  ];
  let published = false;

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
  await page.route("**/api/v1/teacher/review/*/action", async (route) => {
    published = (await route.request().postDataJSON()).action === "published";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ package: records[0] }),
    });
  });
  await page.route("**/api/v1/teacher/review/*", async (route) => {
    const id = route.request().url().split("/").at(-1);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ package: records.find((record) => record.id === id) }),
    });
  });

  await page.goto("/#/teacher");
  await page.getByLabel("教師管理密鑰").fill("teacher-secret");
  await page.getByRole("button", { name: "進入校閱臺" }).click();

  await expect(page.getByRole("heading", { name: "今日待審讀卷" })).toBeVisible();
  await expect(page.locator(".review-detail")).toHaveCount(2);
  await expect(page.getByText("答案：水資源需要兼顧基本需求與公平分配。")).toHaveCount(2);

  await page.locator(".review-detail").first().getByRole("button", { name: "桌面" }).click();
  await expect(page.locator(".student-preview--desktop")).toBeVisible();
  await page.locator(".review-detail").first().getByRole("button", { name: "核准發布" }).click();
  await expect(page.getByRole("status")).toContainText("已建立發布紀錄");
  expect(published).toBe(true);
});
