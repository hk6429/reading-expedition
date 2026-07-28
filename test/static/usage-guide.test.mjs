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

test("首頁載入自學星圖返回入口與獨立到訪計數器", () => {
  const html = read("index.html");
  assert.match(
    html,
    /https:\/\/self-learning-orbit\.pages\.dev\/platform-counter\.js/,
  );
  assert.match(html, /dataset\.site = "reading-expedition"/);
  assert.match(html, /\["localhost", "127\.0\.0\.1"\]/);
  assert.match(html, /max-width: 64rem/);
  assert.match(html, /自學星圖/);
  assert.match(html, /到訪統計/);
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

test("教師驗證頁說明管理密鑰用途與取得方式", () => {
  const review = read("src/ui/review-console.js");

  assert.match(review, /只用來驗證校閱與班級管理權限/);
  assert.match(review, /向本網站管理者或校內負責維護的教師索取/);
  assert.match(review, /不會顯示在學生端/);
});

test("學生入口統一稱為加入班級並先說明班級碼由老師提供", () => {
  const html = read("index.html");
  const guide = read("src/ui/usage-guide.js");
  const classView = read("src/ui/class-view.js");

  assert.match(html, /aria-label="加入班級">加入班級/);
  assert.match(guide, /點選頁首「加入班級」/);
  assert.doesNotMatch(guide, /學生加入班級|頁首「班級共建」/);
  assert.match(classView, /請輸入老師提供的 8 碼班級碼/);
  assert.match(classView, />加入班級</);
});
