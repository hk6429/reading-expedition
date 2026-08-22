import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const reminder = fs.readFileSync(new URL("../../src/ui/backup-reminder.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

test("備份對話框限制 Tab 焦點並在關閉後還原焦點", () => {
  assert.match(reminder, /event\.key !== "Tab"/);
  assert.match(reminder, /previousFocus/);
  assert.match(reminder, /previousFocus\?\.focus/);
});

test("備份對話框操作符合 44px 觸控目標", () => {
  assert.match(styles, /\.backup-reminder__actions[\s\S]+min-height:\s*44px/);
});
