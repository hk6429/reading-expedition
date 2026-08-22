import assert from "node:assert/strict";
import test from "node:test";

import { levelAnswerKeys } from "../../src/data/level-answer-keys.js";
import { levelReadingsById } from "../../src/data/level-readings.js";

test("所有內建分級讀卷都有精準文證與逐錯項診斷", () => {
  for (const reading of Object.values(levelReadingsById)) {
    const keys = levelAnswerKeys[reading.id];
    assert.equal(keys?.length, reading.assessment.length, reading.id);
    for (const item of reading.assessment) {
      const key = keys.find(({ id }) => id === item.id);
      assert.ok(key, item.id);
      const paragraph = reading.body[key.evidenceSpan.paragraph - 1];
      const evidence = paragraph.slice(
        key.evidenceSpan.start,
        key.evidenceSpan.end,
      );
      assert.equal(evidence, key.evidenceSpan.text, item.id);
      assert.ok(evidence.length >= 8 && evidence.length <= 30, item.id);
      const distractors = item.options.filter(
        (option) => option !== key.correctAnswer,
      );
      assert.deepEqual(
        Object.keys(key.distractorReasons).sort(),
        distractors.sort(),
        item.id,
      );
      assert.equal(
        new Set(Object.values(key.distractorReasons)).size,
        3,
        item.id,
      );
    }
  }
});

test("內建干擾項不靠絕對詞就能排除", () => {
  const absoluteShortcuts =
    /必然|唯一|永遠|一定|全部|所有|只能|不必|任何|完全相同|只要.+就/;
  for (const reading of Object.values(levelReadingsById)) {
    for (const item of reading.assessment) {
      const correctAnswer = levelAnswerKeys[reading.id].find(
        ({ id }) => id === item.id,
      ).correctAnswer;
      for (const option of item.options) {
        if (option === correctAnswer) continue;
        assert.doesNotMatch(option, absoluteShortcuts, item.id);
      }
    }
  }
});
