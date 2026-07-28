import assert from "node:assert/strict";
import test from "node:test";

import { growReadingAbilities } from "../../src/domain/ability-growth.js";

test("有效閱讀同時累積理解、推論與文證，修正成功額外強化文證", () => {
  const current = { comprehension: 2, inference: 1, evidence: 3 };
  const completed = growReadingAbilities(current, {
    completed: true,
    evidenceSubmitted: true,
    revisedCount: 1,
  });

  assert.deepEqual(completed, {
    comprehension: 3,
    inference: 2,
    evidence: 5,
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
      { completed: false, evidenceSubmitted: false, revisedCount: 0 },
    ),
    { comprehension: 0, inference: 0, evidence: 0 },
  );
});
