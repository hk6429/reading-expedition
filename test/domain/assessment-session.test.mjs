import assert from "node:assert/strict";
import test from "node:test";

import {
  createAssessmentSession,
  gradeAssessment,
} from "../../src/domain/assessment-session.js";

const answerKey = [
  {
    id: "q1",
    correctAnswer: "基本需要、影響與節水能力",
    rationale: "第三段直接列出三項條件。",
    evidenceSpan: { paragraph: 3, start: 0, end: 63 },
  },
  {
    id: "q2",
    correctAnswer: "第2段",
    rationale: "第二段比較相同比例與不同處境。",
    evidenceSpan: { paragraph: 2, start: 0, end: 70 },
  },
];

test("評分只回傳正誤、理由與文證定位", () => {
  const result = gradeAssessment(answerKey, {
    q1: "只看誰要求得最多",
    q2: "第2段",
  });

  assert.equal(result.results[0].correct, false);
  assert.equal(result.results[0].rationale, "第三段直接列出三項條件。");
  assert.deepEqual(result.results[0].evidenceSpan, {
    paragraph: 3,
    start: 0,
    end: 63,
  });
  assert.equal(result.results[1].correct, true);
});

test("學生送出後可修正一次，第二次修正會被拒絕", async () => {
  const session = createAssessmentSession({
    itemIds: ["q1", "q2"],
    submit: async (answers) => gradeAssessment(answerKey, answers),
  });
  session.answer("q1", "錯誤答案");
  session.answer("q2", "第2段");

  const first = await session.submit();
  assert.equal(first.canRevise, true);

  session.answer("q1", "基本需要、影響與節水能力");
  const second = await session.submit();
  assert.equal(second.canRevise, false);
  await assert.rejects(() => session.submit(), /already final/);
});
