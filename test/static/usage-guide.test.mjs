import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("首頁提供可直接開啟的師生使用說明", () => {
  const html = read("index.html");
  const router = read("src/ui/router.js");
  const app = read("src/app.js");
  assert.match(html, /href="#\/guide"[\s\S]*師生使用說明/);
  assert.match(router, /window\.location\.hash === "#\/guide"/);
  assert.match(app, /renderUsageGuide/);
});

test("使用說明分別提供學生四步與教師四步", () => {
  const guide = read("src/ui/usage-guide.js");
  assert.match(guide, /學生篇/);
  assert.match(guide, /教師篇/);
  assert.match(guide, /選一條航線/);
  assert.match(guide, /校閱後再發布/);
  assert.match(guide, /建立匿名班級/);
  assert.match(guide, /不要求姓名、學號、Email/);
  assert.equal((guide.match(/\["/g) ?? []).length, 8);
});
