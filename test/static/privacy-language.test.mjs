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
  assert.match(readme, /尚未部署/);
});
