import assert from "node:assert/strict";
import test from "node:test";

import {
  appendVerifiedReading,
  hasMainlineRewardForDate,
} from "../../src/domain/reading-history.js";

test("同篇跨日重讀會保留兩天事件，不覆寫舊活躍日", () => {
  const first = appendVerifiedReading([], {
    readingId: "water-sharing-guided-v1",
    date: "2026-07-28",
    category: "world",
    skill: "evidence",
    evidence: "第一天的文證",
  });
  const second = appendVerifiedReading(first.history, {
    readingId: "water-sharing-guided-v1",
    date: "2026-07-29",
    category: "world",
    skill: "evidence",
    evidence: "第二天的文證",
  });

  assert.equal(first.added, true);
  assert.equal(second.added, true);
  assert.deepEqual(
    second.history.map(({ date }) => date),
    ["2026-07-28", "2026-07-29"],
  );
});

test("同篇同日不重複記錄，但同日其他文章仍會收藏", () => {
  const history = [
    {
      id: "water-sharing-guided-v1:2026-07-28",
      readingId: "water-sharing-guided-v1",
      date: "2026-07-28",
      category: "world",
      skill: "evidence",
      evidence: "一段文證",
      mainlineReward: true,
    },
  ];
  const duplicate = appendVerifiedReading(history, {
    readingId: "water-sharing-guided-v1",
    date: "2026-07-28",
    category: "world",
    skill: "evidence",
    evidence: "再次完成",
  });
  const extra = appendVerifiedReading(history, {
    readingId: "moon-phases-guided-v1",
    date: "2026-07-28",
    category: "science",
    skill: "evidence",
    evidence: "另一篇文證",
  });

  assert.equal(duplicate.added, false);
  assert.equal(duplicate.history.length, 1);
  assert.equal(extra.added, true);
  assert.equal(extra.event.mainlineReward, false);
  assert.equal(hasMainlineRewardForDate(extra.history, "2026-07-28"), true);
});
