import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../../", import.meta.url);

test("公開文件清楚說明本機優先與禁收資料", async () => {
  const [html, readme] = await Promise.all([
    readFile(new URL("index.html", projectRoot), "utf8"),
    readFile(new URL("README.md", projectRoot), "utf8"),
  ]);
  const publicCopy = `${html}\n${readme}`;

  assert.match(publicCopy, /保存在這部裝置/);
  assert.match(publicCopy, /不收姓名、學號、Email、學校或班級真名/);
  assert.match(readme, /npm test/);
  assert.match(readme, /Cloudflare Pages：https:\/\/reading-expedition-2u1\.pages\.dev\//);
  assert.match(readme, /Vercel：https:\/\/reading-expedition\.vercel\.app\//);
  assert.match(readme, /Netlify：https:\/\/reading-expedition\.netlify\.app\//);
});

test("學生版隱私說明列出匿名統計內容並提供退出開關", async () => {
  const guide = await readFile(
    new URL("src/ui/usage-guide.js", projectRoot),
    "utf8",
  );

  assert.match(guide, /文章代碼、主題類別、難度、閱讀時間區間與隨機裝置代碼/);
  assert.match(guide, /不會傳送姓名、學號或答案文字/);
  assert.match(guide, /允許傳送匿名使用統計/);
  assert.match(guide, /data-anonymous-statistics/);
});
