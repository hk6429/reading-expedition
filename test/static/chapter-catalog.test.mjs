import assert from "node:assert/strict";
import test from "node:test";

import { chapterCatalog } from "../../src/data/chapter-catalog.js";

test("三十個活躍日依安家、明辨、聚義、開城排列", () => {
  assert.equal(chapterCatalog.length, 30);
  assert.deepEqual(
    [...new Set(chapterCatalog.map(({ phase }) => phase))],
    ["安家", "明辨", "聚義", "開城"],
  );
  assert.deepEqual(
    chapterCatalog.filter(({ review }) => review).map(({ activeDay }) => activeDay),
    [7, 14, 21, 30],
  );
});

test("章節敘事可略過且不以焦慮或損失推動閱讀", () => {
  for (const chapter of chapterCatalog) {
    assert.equal(chapter.skippable, true);
    assert.equal(chapter.blocksReading, false);
    assert.doesNotMatch(
      `${chapter.title}${chapter.story}`,
      /歸零|衰敗|斷簽|失去|錯過就|限時/,
    );
  }
});

test("三十日章回不是重複模板，故事日帶有角色與實際解鎖", () => {
  assert.ok(
    new Set(chapterCatalog.map(({ story }) => story)).size >= 25,
    "至少二十五回應有不同故事",
  );
  const storyChapters = chapterCatalog.filter(
    ({ rewardType }) => rewardType === "story",
  );
  assert.equal(storyChapters.length, 10);
  for (const chapter of storyChapters) {
    assert.ok(chapter.mentor);
    assert.ok(chapter.unlock);
  }
});
