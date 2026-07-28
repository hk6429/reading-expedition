import assert from "node:assert/strict";
import test from "node:test";

import { buildWeeklyReview } from "../../src/domain/weekly-review.js";

test("里程碑回顧呈現文證、主題與能力，不只顯示完成量", () => {
  const review = buildWeeklyReview([
    {
      id: "r-1",
      date: "2026-07-01",
      category: "science",
      skill: "因果推論",
      evidence: "觀測資料顯示溫度逐年升高。",
    },
    {
      id: "r-2",
      date: "2026-07-08",
      category: "humanities",
      skill: "觀點辨識",
      evidence: "作者以居民的選擇呈現不同立場。",
    },
  ]);

  assert.equal(review.validReadings, 2);
  assert.deepEqual(review.categories, ["science", "humanities"]);
  assert.deepEqual(review.skills, ["因果推論", "觀點辨識"]);
  assert.equal(review.evidence.length, 2);
});

test("回顧不接受姓名、自由反思或空白文證", () => {
  assert.throws(
    () => buildWeeklyReview([{ id: "r-1", date: "2026-07-01", name: "小明" }]),
    /not allowed/,
  );
});
