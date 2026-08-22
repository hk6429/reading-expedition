import assert from "node:assert/strict";
import test from "node:test";

import {
  createClassContribution,
  createStructuredHint,
} from "../../src/domain/class-contribution.js";

test("班級貢獻只接受完成證明及其文章識別欄位", () => {
  const completionProof = `${"a".repeat(40)}.${"b".repeat(43)}`;
  assert.deepEqual(
    createClassContribution({
      completionProof,
      readingId: "water-sharing-guided-v1",
      contentKey: "water-sharing",
      version: 1,
    }),
    {
      completionProof,
      readingId: "water-sharing-guided-v1",
      contentKey: "water-sharing",
      version: 1,
    },
  );
  assert.throws(
    () =>
      createClassContribution({
        completionProof,
        readingId: "water-sharing-guided-v1",
        contentKey: "water-sharing",
        version: 1,
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
