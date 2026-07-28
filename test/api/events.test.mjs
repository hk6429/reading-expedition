import assert from "node:assert/strict";
import test from "node:test";

import { createEventsApi } from "../../worker/src/api/events.js";
import { assertEventBatch } from "../../worker/src/api/event-schema.js";

const validEvent = {
  type: "reading_completed",
  occurredAt: "2026-07-28T08:00:00.000Z",
  context: {
    contentId: "water-guided-v1",
    category: "world",
    difficulty: "guided",
    durationBucket: "6-10m",
    deviceId: "anonymous-device-123",
  },
};

test("匿名事件只接受八種型別與五種 context 欄位", () => {
  assert.equal(assertEventBatch({ events: [validEvent] }).length, 1);
  assert.throws(
    () => assertEventBatch({ events: [{ ...validEvent, type: "student_named" }] }),
    /event type/,
  );
  assert.throws(
    () =>
      assertEventBatch({
        events: [{ ...validEvent, context: { ...validEvent.context, name: "小明" } }],
      }),
    /not allowed/,
  );
});

test("事件 API 拒絕自由文字，成功時只回接收數量", async () => {
  const saved = [];
  const api = createEventsApi({
    repository: { recordAnonymousEvents: async (events) => saved.push(...events) },
  });
  const ok = await api.collect(
    new Request("https://example.test/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: [validEvent] }),
    }),
  );
  assert.equal(ok.status, 202);
  assert.deepEqual(await ok.json(), { accepted: 1 });
  assert.equal(saved.length, 1);

  const denied = await api.collect(
    new Request("https://example.test/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        events: [{ ...validEvent, reflection: "我今天覺得……" }],
      }),
    }),
  );
  assert.equal(denied.status, 400);
});
