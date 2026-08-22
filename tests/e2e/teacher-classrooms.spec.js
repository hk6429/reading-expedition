import { expect, test } from "./fixtures.js";

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
  await expect(
    page.getByRole("heading", { name: "一座城市如何分配有限水源？" }),
  ).toBeVisible();
  const nightButton = page.getByRole("button", { name: "夜讀" });
  const settingsButton = page.getByRole("button", { name: "顯示設定" });
  if (await settingsButton.isVisible()) await settingsButton.click();
  await expect(nightButton).toBeVisible();
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

test("教師以聚合資料設定共同任務並取得十分鐘介入卡", async ({ page }) => {
  let missionRequest = null;
  await page.addInitScript(() => {
    sessionStorage.setItem("reading-expedition.csrf", "csrf-demo");
    sessionStorage.setItem(
      "reading-expedition.teacher-class-codes",
      JSON.stringify({ "class-mission": "MISSION2" }),
    );
  });
  await page.route("**/api/v1/teacher/classrooms", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        classrooms: [
          {
            id: "class-mission",
            createdAt: "2026-08-20T00:00:00Z",
            expiresAt: "2027-02-20T00:00:00Z",
            revokedAt: null,
            anonymousParticipants: 8,
            validReadings: 24,
            privacyProtected: false,
            weeklyPeriod: "2026-W34",
            weeklyValidReadings: 6,
            weeklyMissionTarget: 10,
            mission: { type: "shared_readings", target: 10 },
            categoryDistribution: { world: 8, science: 7, humanities: 9 },
            skillDistribution: { comprehension: 10, inference: 4, evidence: 8 },
            abilityMetrics: {
              comprehension: { opportunities: 10, firstCorrect: 8 },
              inference: { opportunities: 8, firstCorrect: 3 },
              evidence: { opportunities: 9, firstCorrect: 7 },
            },
          },
        ],
      }),
    });
  });
  await page.route(
    "**/api/v1/teacher/classrooms/class-mission/mission",
    async (route) => {
      missionRequest = {
        body: route.request().postDataJSON(),
        csrf: route.request().headers()["x-csrf-token"],
      };
      await route.fulfill({ status: 200, body: "{}" });
    },
  );

  await page.goto("/#/teacher/classes");
  await expect(page.getByRole("heading", { name: "匿名能力熱圖" })).toBeVisible();
  await expect(page.getByText("10 分鐘線索連線")).toBeVisible();
  await page.evaluate(() => {
    window.__interventionPrintCalls = 0;
    window.print = () => {
      window.__interventionPrintCalls += 1;
    };
  });
  await page.getByRole("button", { name: "列印介入卡" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__interventionPrintCalls))
    .toBe(1);
  await expect(page.locator("body")).not.toHaveClass(/is-printing-intervention/);
  await page.getByLabel("能力練習").check();
  await page.getByRole("button", { name: "儲存共同任務" }).click();

  await expect(page.getByText(/已儲存「能力練習」/)).toBeVisible();
  expect(missionRequest).toEqual({
    body: { type: "ability_practice" },
    csrf: "csrf-demo",
  });
});

test("G069 教師以結構選項指派文章且期限不產生懲罰", async ({ page }) => {
  let assignmentRequest = null;
  let currentAssignment = null;
  await page.addInitScript(() => {
    sessionStorage.setItem("reading-expedition.csrf", "csrf-assignment");
  });
  await page.route("**/api/v1/readings?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        readings: [
          {
            id: "water-sharing-guided-v1",
            title: "一座城市如何分配水源？",
            answer: "不應進入指派",
          },
          {
            id: "forest-path-independent-v1",
            title: "森林裡的兩條路",
          },
        ],
        pagination: { hasMore: false },
      }),
    });
  });
  await page.route("**/api/v1/teacher/classrooms", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        classrooms: [
          {
            id: "class-assignment",
            createdAt: "2026-08-20T00:00:00Z",
            expiresAt: "2027-02-20T00:00:00Z",
            revokedAt: null,
            anonymousParticipants: 2,
            validReadings: 4,
            currentAssignment,
          },
        ],
      }),
    });
  });
  await page.route(
    "**/api/v1/teacher/classrooms/class-assignment/assignment",
    async (route) => {
      assignmentRequest = {
        body: route.request().postDataJSON(),
        csrf: route.request().headers()["x-csrf-token"],
      };
      currentAssignment = assignmentRequest.body;
      await route.fulfill({ status: 201, body: "{}" });
    },
  );

  await page.goto("/#/teacher/classes");
  const assignment = page.locator(".class-mission__assignment");
  await expect(
    assignment.getByRole("heading", { name: "指派閱讀任務" }),
  ).toBeVisible();
  await assignment.getByLabel("選擇文章").selectOption(
    "forest-path-independent-v1",
  );
  await assignment.getByLabel("練習能力").selectOption("inference");
  await assignment.getByLabel(/兩者等價/).check();
  await assignment.getByLabel("無期限").uncheck();
  await assignment.getByLabel("日期期限").fill("2026-09-01");
  await assignment.getByRole("button", { name: "儲存閱讀指派" }).click();

  await expect(assignment.getByRole("status")).toContainText(
    "森林裡的兩條路",
  );
  await expect(assignment.getByText(/逾期不扣分、不倒數、不歸零/)).toBeVisible();
  expect(assignmentRequest).toEqual({
    body: {
      readingId: "forest-path-independent-v1",
      title: "森林裡的兩條路",
      ability: "inference",
      route: "equivalent",
      dueDate: "2026-09-01",
    },
    csrf: "csrf-assignment",
  });
  await page.reload();
  await expect(assignment.getByLabel("選擇文章")).toHaveValue(
    "forest-path-independent-v1",
  );
  await expect(assignment.getByLabel("練習能力")).toHaveValue("inference");
  await expect(assignment.getByLabel("日期期限")).toHaveValue("2026-09-01");
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

test("同一瀏覽器多個教師分頁使用最新驗證碼停用班級", async ({
  context,
}) => {
  let loginCount = 0;
  let classroom = {
    id: "class-shared-session",
    createdAt: "2026-07-29T00:00:00Z",
    expiresAt: "2027-01-25T00:00:00Z",
    revokedAt: null,
    anonymousParticipants: 0,
    validReadings: 0,
  };

  async function prepare(page) {
    await page.route("**/api/v1/teacher/session", async (route) => {
      loginCount += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          csrfToken: loginCount === 1 ? "csrf-old" : "csrf-latest",
          expiresAt: "2026-07-29T12:00:00Z",
        }),
      });
    });
    await page.route("**/api/v1/teacher/classrooms", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ classrooms: [classroom] }),
      });
    });
    await page.route(
      "**/api/v1/teacher/classrooms/class-shared-session",
      async (route) => {
        if (route.request().headers()["x-csrf-token"] !== "csrf-latest") {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ error: { code: "csrf_invalid" } }),
          });
          return;
        }
        classroom = {
          ...classroom,
          revokedAt: "2026-07-29T03:30:00Z",
        };
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      },
    );
  }

  const firstTab = await context.newPage();
  await prepare(firstTab);
  await firstTab.goto("/#/teacher/classes");
  await firstTab.getByLabel("教師管理密鑰").fill("teacher-secret");
  await firstTab.getByRole("button", { name: "進入校閱臺" }).click();

  const secondTab = await context.newPage();
  await prepare(secondTab);
  await secondTab.goto("/#/teacher/classes");
  await secondTab.getByRole("button", { name: "安全登出" }).click();
  await secondTab.getByLabel("教師管理密鑰").fill("teacher-secret");
  await secondTab.getByRole("button", { name: "進入校閱臺" }).click();

  await firstTab.locator("[data-revoke-classroom]").click();
  await firstTab.getByRole("button", { name: "確定停用" }).click();

  await expect(
    firstTab.getByText("班級已停用，原有班級碼與學生權杖皆已失效。"),
  ).toBeVisible();
  await expect(firstTab.getByText("已停用", { exact: true })).toBeVisible();
});

test("教師驗證失效時引導重新登入而非誤報網路問題", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("reading-expedition.csrf", "csrf-stale");
  });
  await page.route("**/api/v1/teacher/classrooms", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        classrooms: [
          {
            id: "class-stale-session",
            createdAt: "2026-07-29T00:00:00Z",
            expiresAt: "2027-01-25T00:00:00Z",
            revokedAt: null,
            anonymousParticipants: 0,
            validReadings: 0,
          },
        ],
      }),
    });
  });
  await page.route(
    "**/api/v1/teacher/classrooms/class-stale-session",
    async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "csrf_invalid" } }),
      });
    },
  );

  await page.goto("/#/teacher/classes");
  await page.locator("[data-revoke-classroom]").click();
  await page.getByRole("button", { name: "確定停用" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "教師驗證" }),
  ).toBeVisible();
  await expect(
    page.getByText("教師登入狀態已更新，請重新登入後再停用班級。"),
  ).toBeVisible();
});

test("舊畫面重複停用已關閉班級時會重新同步狀態", async ({ page }) => {
  let alreadyRevoked = false;
  await page.addInitScript(() => {
    sessionStorage.setItem("reading-expedition.csrf", "csrf-demo");
  });
  await page.route("**/api/v1/teacher/classrooms", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        classrooms: [
          {
            id: "class-already-revoked",
            createdAt: "2026-07-29T00:00:00Z",
            expiresAt: "2027-01-25T00:00:00Z",
            revokedAt: alreadyRevoked ? "2026-07-29T03:30:00Z" : null,
            anonymousParticipants: 0,
            validReadings: 0,
          },
        ],
      }),
    });
  });
  await page.route(
    "**/api/v1/teacher/classrooms/class-already-revoked",
    async (route) => {
      alreadyRevoked = true;
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "classroom_not_found" },
        }),
      });
    },
  );

  await page.goto("/#/teacher/classes");
  await page.locator("[data-revoke-classroom]").click();
  await page.getByRole("button", { name: "確定停用" }).click();

  await expect(
    page.getByText("班級已停用，畫面已同步最新狀態。"),
  ).toBeVisible();
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
