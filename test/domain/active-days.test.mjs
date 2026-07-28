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

test("缺席不清零，第三十個活躍日解鎖下一航季並保留城市", () => {
  const completed = Object.fromEntries(
    Array.from({ length: 30 }, (_, index) => [
      `reading-${index + 1}`,
      { date: `2026-08-${String(index + 1).padStart(2, "0")}` },
    ]),
  );
  const progress = resolveChapterProgress(completed);
  assert.equal(progress.activeDay, 30);
  assert.equal(progress.nextSeasonUnlocked, true);
  assert.equal(progress.resetCity, false);
});

test("事件簿以日期推進章回，同篇跨日重讀不會吃掉舊紀錄", () => {
  const history = [
    { readingId: "same-reading", date: "2026-07-01" },
    { readingId: "same-reading", date: "2026-07-09" },
    { readingId: "other-reading", date: "2026-07-09" },
  ];

  assert.equal(countHistoryActiveDays(history), 2);
  assert.equal(resolveHistoryChapterProgress(history).activeDay, 2);
});
