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
