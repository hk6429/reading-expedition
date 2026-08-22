import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const html = fs.readFileSync(new URL("index.html", root), "utf8");
const manifest = JSON.parse(
  fs.readFileSync(new URL("manifest.webmanifest", root), "utf8"),
);

test("首頁宣告 manifest、主題色與 Apple 觸控圖示", () => {
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /name="theme-color"/);
  assert.match(html, /rel="apple-touch-icon"/);
});

test("PWA manifest 有效且圖示檔案尺寸宣告完整", () => {
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 2);
  for (const icon of manifest.icons) {
    assert.equal(icon.type, "image/png");
    assert.ok(fs.existsSync(new URL(icon.src.slice(1), root)));
  }
});
