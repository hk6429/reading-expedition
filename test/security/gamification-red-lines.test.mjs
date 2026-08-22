import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { createClassContribution } from "../../src/domain/class-contribution.js";

async function sourceFiles(directory) {
  const entries = await readdir(new URL(directory, import.meta.url), {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => new URL(`${directory}${entry.name}`, import.meta.url));
}

test("學生遊戲化程式不得建立排行榜、抽箱、稀有度或斷簽機制", async () => {
  const files = [
    ...(await sourceFiles("../../src/ui/")),
    ...(await sourceFiles("../../src/domain/")),
  ];
  const source = (
    await Promise.all(files.map((file) => readFile(file, "utf8")))
  ).join("\n");

  assert.doesNotMatch(source, /class(Name)?\s*=.*leaderboard/i);
  assert.doesNotMatch(source, /loot[_ -]?box|gacha|rarity[_ -]?tier/i);
  assert.doesNotMatch(source, /streak[_ -]?reset|missed[_ -]?reward/i);
});

test("班級貢獻拒絕身分、答案與自由文字欄位", () => {
  const base = {
    completionProof: `${"a".repeat(40)}.${"b".repeat(43)}`,
    readingId: "reading-1",
    contentKey: "canonical-reading-1",
    version: 1,
  };
  for (const [field, value] of [
    ["name", "學生姓名"],
    ["answer", "完整答案"],
    ["reflection", "自由心得"],
    ["studentId", "123456"],
  ]) {
    assert.throws(() => createClassContribution({ ...base, [field]: value }));
  }
});
