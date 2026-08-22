import assert from "node:assert/strict";
import test from "node:test";

import { createAssessmentSession } from "../../src/domain/assessment-session.js";

test("初次通過會保留該次伺服器完成證明", async () => {
  const session = createAssessmentSession({
    itemIds: ["q1"],
    submit: async () => ({
      results: [{ id: "q1", correct: true }],
      completionProof: "proof-first-pass",
    }),
  });
  session.answer("q1", "甲");

  const result = await session.submit();

  assert.equal(result.completionProof, "proof-first-pass");
  assert.equal(result.attempt, 1);
});

test("修正後通過會使用第二次回應中的最新完成證明", async () => {
  let calls = 0;
  const session = createAssessmentSession({
    itemIds: ["q1"],
    submit: async () => {
      calls += 1;
      return calls === 1
        ? { results: [{ id: "q1", correct: false }] }
        : {
            results: [{ id: "q1", correct: true }],
            completionProof: "proof-after-revision",
          };
    },
  });
  session.answer("q1", "甲");
  const first = await session.submit();
  session.answer("q1", "乙");

  const revised = await session.submit();

  assert.equal(first.completionProof, undefined);
  assert.equal(revised.completionProof, "proof-after-revision");
  assert.equal(revised.attempt, 2);
});
