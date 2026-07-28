import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("教師建立、複製並停用匿名班級", async ({ page }) => {
  let classroom = null;
  let copiedCode = "";

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__copiedClassCode = value;
        },
      },
    });
  });
  await page.route("**/api/v1/teacher/session", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        csrfToken: "csrf-demo",
        expiresAt: "2026-07-29T00:00:00Z",
      }),
    });
  });
  await page.route("**/api/v1/teacher/review?status=review", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ packages: [] }),
    });
  });
  await page.route("**/api/v1/teacher/classrooms", async (route) => {
    if (route.request().method() === "POST") {
      classroom = {
        id: "class-001",
        classCode: "CLASS2A3",
        createdAt: "2026-07-28T00:00:00Z",
        expiresAt: "2027-01-24T00:00:00Z",
        revokedAt: null,
        anonymousParticipants: 0,
        validReadings: 0,
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(classroom),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        classrooms: classroom ? [classroom] : [],
      }),
    });
  });
  await page.route(
    "**/api/v1/teacher/classrooms/class-001",
    async (route) => {
      classroom = { ...classroom, revokedAt: "2026-07-28T00:10:00Z" };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    },
  );
  page.on("dialog", async (dialog) => dialog.accept());

  await page.goto("/#/teacher/classes");
  await page.getByLabel("教師管理密鑰").fill("teacher-secret");
  await page.getByRole("button", { name: "進入校閱臺" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "班級管理" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "建立新班級" }).click();
  const createdCallout = page.locator(".classroom-created");
  await expect(createdCallout).toBeVisible();
  await expect(
    createdCallout.getByText("CLASS2A3", { exact: true }),
  ).toBeVisible();
  const createdBox = await createdCallout.boundingBox();
  const viewport = page.viewportSize();
  expect(createdBox.y + createdBox.height).toBeLessThanOrEqual(
    viewport.height,
  );

  await createdCallout
    .getByRole("button", { name: /複製班級碼/ })
    .click();
  copiedCode = await page.evaluate(() => window.__copiedClassCode);
  expect(copiedCode).toBe("CLASS2A3");
  await expect(page.locator("[data-classroom-message]")).toContainText(
    "已複製",
  );

  await page.getByRole("button", { name: /停用班級/ }).click();
  await expect(page.getByText("已停用", { exact: true })).toBeVisible();
});

test("教師可安全登出並清除本機工作階段", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("reading-expedition.csrf", "csrf-demo");
  });
  await page.route("**/api/v1/teacher/classrooms", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ classrooms: [] }),
    });
  });
  await page.route("**/api/v1/teacher/session", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/#/teacher/classes");
  await page.getByRole("button", { name: "安全登出" }).click();

  await expect(page.getByRole("heading", { name: "教師驗證" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("reading-expedition.csrf"),
      ),
    )
    .toBeNull();
});
