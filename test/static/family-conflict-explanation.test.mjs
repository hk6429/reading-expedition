import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../../src/ui/family-view.js", import.meta.url),
  "utf8",
);

test("跨裝置衝突先比較本機與雲端來源、版本與時間再讓家長選擇", () => {
  assert.match(source, /本機來源/);
  assert.match(source, /雲端來源/);
  assert.match(source, /stateVersion/);
  assert.match(source, /updatedAt/);
  assert.match(source, /failedAt/);
  assert.match(source, /改用雲端較新版本/);
  assert.match(source, /先下載目前孩子 JSON 備份/);
});
