import assert from "node:assert/strict";
import test from "node:test";

import { demoAnswerKeys } from "../../src/data/demo-answer-key.js";
import { demoDailyReadings } from "../../src/data/demo-daily.js";
import { demoReadingsById } from "../../src/data/demo-readings.js";

test("安全試讀清單中的每張卡都有正文、題組與答案", () => {
  for (const reading of demoDailyReadings) {
    const detail = demoReadingsById[reading.id];
    assert.ok(detail, `${reading.id} 缺少正文`);
    assert.equal(detail.assessment.length, 3);
    assert.equal(demoAnswerKeys[reading.id]?.length, 3);
  }
});

test("安全試讀文證皆為正文內 8 到 30 個連續字元", () => {
  for (const [readingId, items] of Object.entries(demoAnswerKeys)) {
    const reading = demoReadingsById[readingId];
    for (const item of items) {
      const span = item.evidenceSpan;
      const evidence = reading.body[span.paragraph - 1].slice(
        span.start,
        span.end,
      );
      assert.ok(evidence.length >= 8 && evidence.length <= 30);
      assert.equal(evidence, span.text, item.id);
      const assessmentItem = reading.assessment.find(
        ({ id }) => id === item.id,
      );
      assert.ok(assessmentItem, item.id);
      assert.ok(
        assessmentItem.options.includes(item.correctAnswer),
        `${item.id} 的正解必須存在於選項`,
      );
    }
  }
});
