import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function contrastRatio(locator, surfaceSelector) {
  return locator.evaluate((element, selector) => {
    function rgb(value) {
      return value
        .match(/\d+(?:\.\d+)?/g)
        .slice(0, 3)
        .map(Number);
    }
    function luminance(value) {
      const channels = rgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return (
        0.2126 * channels[0] +
        0.7152 * channels[1] +
        0.0722 * channels[2]
      );
    }
    const foreground = getComputedStyle(element).color;
    const background = getComputedStyle(element.closest(selector)).backgroundColor;
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return (light + 0.05) / (dark + 0.05);
  }, surfaceSelector);
}

test("夜讀模式下班級管理文字仍可清楚閱讀", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("reading-expedition.csrf", "csrf-demo");
  });
  await page.route("**/api/v1/teacher/classrooms", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        classrooms: [
          {
            id: "class-night",
            createdAt: "2026-07-28T00:00:00Z",
            expiresAt: "2027-01-24T00:00:00Z",
            revokedAt: null,
            anonymousParticipants: 2,
            validReadings: 5,
          },
        ],
      }),
    });
  });

  await page.goto("/#/read/water-sharing-guided-v1");
  const nightButton = page.getByRole("button", { name: "夜讀" });
  if (!(await nightButton.isVisible())) {
    await page.getByRole("button", { name: "顯示設定" }).click();
  }
  await nightButton.click();
  await page.goto("/#/teacher/classes");

  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-mode",
    "night",
  );
  await expect
    .poll(() =>
      contrastRatio(
        page.getByRole("heading", { level: 2, name: "班級管理" }),
        ".classroom-manager",
      ),
    )
    .toBeGreaterThanOrEqual(4.5);
  await expect
    .poll(() =>
      contrastRatio(
        page.getByRole("heading", { level: 3, name: /建立於/ }),
        ".classroom-card",
      ),
    )
    .toBeGreaterThanOrEqual(4.5);
});

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
  await expect(
    page.getByText("確定停用這個班級？", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("已停用", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "確定停用" }).click();
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
