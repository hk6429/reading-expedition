import assert from "node:assert/strict";
import test from "node:test";

import {
  createClassContribution,
  createStructuredHint,
} from "../../src/domain/class-contribution.js";

test("班級只同步內容識別、有效閱讀、類別、能力與日期區間", () => {
  assert.deepEqual(
    createClassContribution({
      validReading: true,
      contentId: "water-sharing-guided-v1",
      category: "science",
      skill: "evidence",
      period: "2026-W31",
    }),
    {
      validReading: true,
      contentId: "water-sharing-guided-v1",
      category: "science",
      skill: "evidence",
      period: "2026-W31",
    },
  );
  assert.throws(
    () =>
      createClassContribution({
        validReading: true,
        contentId: "water-sharing-guided-v1",
        category: "science",
        skill: "evidence",
        period: "2026-W31",
        answer: "不可上傳",
      }),
    /not allowed/,
  );
});

test("義氣提示是固定結構且不含答案或自由聊天", () => {
  const hint = createStructuredHint({
    focus: "evidence",
    messageKey: "return_to_paragraph",
  });

  assert.deepEqual(hint, {
    focus: "evidence",
    messageKey: "return_to_paragraph",
  });
  assert.equal("text" in hint, false);
});
