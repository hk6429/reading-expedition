import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../../", import.meta.url);

test("首頁提供繁體中文、響應式設定與無 JavaScript 說明", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");

  assert.match(html, /<html lang="zh-Hant-TW">/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /src="\.\/src\/app\.js"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /<noscript>[\s\S]*每天十分鐘/);
});
