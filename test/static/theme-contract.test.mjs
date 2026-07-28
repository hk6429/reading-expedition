import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCoreReading,
  CORE_CATEGORIES,
  CORE_DIFFICULTIES,
} from "../../src/data/content-schema.js";
import { waterMarginTheme } from "../../src/theme/water-margin.js";

test("核心閱讀資料保持中性，水滸名稱由主題層映射", () => {
  assert.deepEqual(CORE_CATEGORIES, ["world", "science", "humanities"]);
  assert.deepEqual(CORE_DIFFICULTIES, ["guided", "challenge"]);

  const reading = assertCoreReading({
    id: "reading-001-guided",
    category: "world",
    difficulty: "guided",
    title: "一座城市如何面對缺水？",
  });

  assert.equal(reading.category, "world");
  assert.equal(waterMarginTheme.categoryLabels[reading.category], "四海航線");
  assert.equal(waterMarginTheme.difficultyLabels[reading.difficulty], "行舟卷");
  assert.doesNotMatch(JSON.stringify(reading), /梁山|宋江|墨磚|四海航線|行舟卷/);
});

test("核心閱讀拒絕未核准的類別與難度", () => {
  assert.throws(
    () =>
      assertCoreReading({
        id: "bad-category",
        category: "sports",
        difficulty: "guided",
        title: "不合法內容",
      }),
    /category/,
  );
  assert.throws(
    () =>
      assertCoreReading({
        id: "bad-difficulty",
        category: "science",
        difficulty: "easy",
        title: "不合法內容",
      }),
    /difficulty/,
  );
});
