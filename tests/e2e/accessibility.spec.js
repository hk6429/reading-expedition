import { expect, test } from "./fixtures.js";

test.use({ serviceWorkers: "block" });

test("文字放大 200% 仍可操作，主要流程可用鍵盤啟動", async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

  const button = page
    .getByRole("article")
    .getByRole("button", { name: /引導模式/ });
  await expect(button).toBeVisible();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/read\//);
});

test("跳至主要內容不改寫 SPA hash 且把焦點交給 main", async ({ page }) => {
  await page.goto("/#/read/water-sharing-guided-v1");
  await expect(page.locator(".reading-header h1")).toBeVisible();
  const before = page.url();
  const skipLink = page.locator(".skip-link");
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator("#main-content")).toBeFocused();
  expect(page.url()).toBe(before);
});

test("320px 與 200% 文字不水平溢位且操作列不遮住文末內容", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/#/read/water-sharing-guided-v1");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const endButton = page.getByRole("button", { name: "我已讀到文末" });
  await endButton.scrollIntoViewIfNeeded();
  const size = await endButton.boundingBox();
  expect(size.width).toBeGreaterThanOrEqual(44);
  expect(size.height).toBeGreaterThanOrEqual(44);
  const overlaps = await page.evaluate(() => {
    const content = document.querySelector(".quiz-readiness").getBoundingClientRect();
    const toolbar = document.querySelector(".reading-controls").getBoundingClientRect();
    return !(
      content.bottom <= toolbar.top ||
      content.top >= toolbar.bottom ||
      content.right <= toolbar.left ||
      content.left >= toolbar.right
    );
  });
  expect(overlaps).toBe(false);
});

test("語音朗讀緊接標題且從標題起五次 Tab 內可到達", async ({ page }) => {
  await page.goto("/#/read/water-sharing-guided-v1");
  const title = page.locator(".reading-header h1");
  const speech = page.getByRole("button", { name: "朗讀", exact: true });
  await expect(speech).toBeVisible();
  expect(
    await title.evaluate((heading) => {
      const button = document.querySelector(".reading-header .speech-controls button");
      return Boolean(
        heading.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }),
  ).toBe(true);
  await title.evaluate((heading) => {
    heading.tabIndex = -1;
    heading.focus();
  });
  let tabs = 0;
  while (!(await speech.evaluate((button) => button === document.activeElement))) {
    await page.keyboard.press("Tab");
    tabs += 1;
    expect(tabs).toBeLessThanOrEqual(5);
  }
});

test("reduced motion 生效且所有主要圖片有替代文字或裝飾標記", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const transition = await page.locator(".hero-illustration").evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(["0s", "0.00001s", "1e-05s"]).toContain(transition);
  await expect(page.locator(".hero-illustration img[alt]")).toHaveCount(1);
  await expect(page.locator(".route-art[alt='']")).toHaveCount(1);
});

test("reduced motion 下程式觸發的頁內捲動不使用平滑動畫", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.__scrollBehaviors = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function patched(options) {
      window.__scrollBehaviors.push(options?.behavior ?? "auto");
      return original.call(this, options);
    };
  });
  await page.goto("/#/read/water-sharing-guided-v1");
  await page.getByText("分配", { exact: true }).first().click();
  expect(await page.evaluate(() => window.__scrollBehaviors)).toContain("auto");
  expect(await page.evaluate(() => window.__scrollBehaviors)).not.toContain(
    "smooth",
  );
});
