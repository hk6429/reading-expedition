import { expect, test as base } from "@playwright/test";

const REMINDER_TEST_TITLE = "每位閱行者進入時先看到個人備份提醒";

export const test = base.extend({
  autoDismissBackupReminder: [
    async ({ page }, use, testInfo) => {
      if (testInfo.title !== REMINDER_TEST_TITLE) {
        await page.addInitScript(() => {
          const originalGetItem = Storage.prototype.getItem;
          Storage.prototype.getItem = function getItem(key) {
            if (
              this === window.sessionStorage &&
              String(key).startsWith("reading-expedition:backup-reminder:")
            ) {
              return "seen";
            }
            return originalGetItem.call(this, key);
          };
        });
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
