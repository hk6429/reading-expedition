import assert from "node:assert/strict";
import test from "node:test";

import { assertEventBatch } from "../../worker/src/api/event-schema.js";

test("匿名事件不得包含個資、答案、自由文字或裝置指紋", () => {
  const base = {
    type: "reading_completed",
    occurredAt: "2026-07-28T08:00:00Z",
    context: {
      contentId: "reading-1",
      category: "science",
      difficulty: "guided",
      durationBucket: "6-10m",
      deviceId: "random-device-1",
    },
  };
  for (const [key, value] of [
    ["name", "小明"],
    ["email", "student@example.test"],
    ["answer", "甲"],
    ["reflection", "心得"],
    ["userAgent", "browser fingerprint"],
  ]) {
    assert.throws(() =>
      assertEventBatch({
        events: [{ ...base, context: { ...base.context, [key]: value } }],
      }),
    );
  }
});
