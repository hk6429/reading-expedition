import assert from "node:assert/strict";
import test from "node:test";

import { growReadingAbilities } from "../../src/domain/ability-growth.js";

test("舊版能力點數只由第一次答對的題型累積，不讓修正混入", () => {
  const current = { comprehension: 2, inference: 1, evidence: 3 };
  const completed = growReadingAbilities(current, {
    completed: true,
    items: [
      { type: "comprehension", firstCorrect: true },
      { type: "inference", firstCorrect: false, finalCorrect: true },
      { type: "evidence", firstCorrect: true },
    ],
  });

  assert.deepEqual(completed, {
    comprehension: 3,
    inference: 1,
    evidence: 4,
  });
  assert.deepEqual(current, {
    comprehension: 2,
    inference: 1,
    evidence: 3,
  });
});

test("未完成有效閱讀不增加能力", () => {
  assert.deepEqual(
    growReadingAbilities(
      { comprehension: 0, inference: 0, evidence: 0 },
      { completed: false, items: [] },
    ),
    { comprehension: 0, inference: 0, evidence: 0 },
  );
});
