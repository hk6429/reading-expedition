import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const router = fs.readFileSync(new URL("../../src/ui/router.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("路由切換會更新標題、目前頁與單一狀態宣告", () => {
  assert.match(router, /document\.title\s*=/);
  assert.match(router, /aria-current/);
  assert.match(router, /route-status/);
  assert.match(html, /id="route-status"/);
  assert.match(html, /aria-live="polite"/);
});
