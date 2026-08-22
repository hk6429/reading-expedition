import assert from "node:assert/strict";
import test from "node:test";

import {
  countActiveDays,
  countHistoryActiveDays,
  resolveChapterProgress,
  resolveHistoryChapterProgress,
} from "../../src/domain/active-days.js";

test("活躍日以完成閱讀的不同日期計算，不要求連續", () => {
  const completed = {
    a: { date: "2026-07-01" },
    b: { date: "2026-07-01" },
    c: { date: "2026-07-09" },
    d: { date: "2026-07-28" },
  };
  assert.equal(countActiveDays(completed), 3);
  assert.equal(resolveChapterProgress(completed).activeDay, 3);
});

test("缺席不清零，第三十個活躍日完成第一季但不假稱第二季已開放", () => {
  const completed = Object.fromEntries(
    Array.from({ length: 30 }, (_, index) => [
      `reading-${index + 1}`,
      { date: `2026-08-${String(index + 1).padStart(2, "0")}` },
    ]),
  );
  const progress = resolveChapterProgress(completed);
  assert.equal(progress.activeDay, 30);
  assert.equal(progress.firstSeasonComplete, true);
  assert.equal(progress.nextSeasonUnlocked, false);
  assert.equal(progress.nextSeasonStatus, "planned");
  assert.equal(progress.resetCity, false);
});

test("事件簿只以主線文證日期推進，同篇跨日重讀保留但不灌活躍日", () => {
  const history = [
    { readingId: "same-reading", date: "2026-07-01", mainlineReward: true },
    { readingId: "same-reading", date: "2026-07-09", mainlineReward: false },
    { readingId: "other-reading", date: "2026-07-09", mainlineReward: true },
  ];

  assert.equal(countHistoryActiveDays(history), 2);
  assert.equal(resolveHistoryChapterProgress(history).activeDay, 2);
});
