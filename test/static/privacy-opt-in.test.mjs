import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../../src/app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const guide = fs.readFileSync(new URL("../../src/ui/usage-guide.js", import.meta.url), "utf8");

test("匿名統計必須明確 opt-in，未選擇時不傳事件也不載入計數器", () => {
  assert.match(app, /getItem\(ANONYMOUS_STATISTICS_KEY\) === "on"/);
  assert.match(html, /getItem\(anonymousStatisticsKey\) !== "on"/);
  assert.match(guide, /anonymousStatisticsEnabled = false/);
});

test("匿名學生首頁不預載跨網域 SSO 腳本", () => {
  assert.doesNotMatch(html, /naicheng-sso\.js/);
  assert.doesNotMatch(html, /<script[^>]+src="https:\/\//);
});
