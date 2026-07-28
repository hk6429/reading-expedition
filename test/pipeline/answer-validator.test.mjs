import assert from "node:assert/strict";
import test from "node:test";

import { validateAssessmentAnswers } from "../../worker/src/pipeline/answer-validator.js";

const reading = {
  body: [{ id: "p1", text: "海水受熱會膨脹，陸地冰融化也會增加海水。" }],
};

test("多重正解或不存在的文證不得發布", () => {
  const duplicate = validateAssessmentAnswers(reading, [
    {
      id: "q1",
      options: ["膨脹", "膨脹", "結冰"],
      correctAnswer: "膨脹",
      distractorReasons: { 結冰: "與原文相反" },
      evidenceSpan: { paragraph: 1, start: 0, end: 7, text: "海水受熱會膨脹" },
    },
  ]);
  const missingEvidence = validateAssessmentAnswers(reading, [
    {
      id: "q1",
      options: ["膨脹", "消失", "結冰"],
      correctAnswer: "膨脹",
      distractorReasons: { 消失: "未提及", 結冰: "與原文相反" },
      evidenceSpan: { paragraph: 1, start: 0, end: 4, text: "原文沒有" },
    },
  ]);

  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.includes("multiple_correct_answers"));
  assert.equal(missingEvidence.ok, false);
  assert.ok(missingEvidence.errors.includes("evidence_not_found"));
});
