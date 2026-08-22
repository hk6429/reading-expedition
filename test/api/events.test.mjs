import assert from "node:assert/strict";
import test from "node:test";

import { createEventsApi } from "../../worker/src/api/events.js";
import { assertEventBatch } from "../../worker/src/api/event-schema.js";

const validEvent = {
  id: "018f6f5e-89ab-7def-8123-456789abcdef",
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

function eventRequest(payload, headers = {}) {
  return new Request("https://example.test/api/v1/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://example.test",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

test("事件 API 拒絕自由文字，成功時回傳新增與重複數量", async () => {
  const saved = [];
  const api = createEventsApi({
    repository: {
      countRecentAnonymousEvents: async () => 0,
      recordAnonymousEvents: async (events) => {
        saved.push(...events);
        return { accepted: events.length, duplicates: 0 };
      },
    },
    clock: () => new Date("2026-07-28T08:00:00.000Z"),
  });
  const ok = await api.collect(eventRequest({ events: [validEvent] }));
  assert.equal(ok.status, 202);
  assert.deepEqual(await ok.json(), { accepted: 1, duplicates: 0 });
  assert.equal(saved.length, 1);

  const denied = await api.collect(eventRequest({
    events: [{ ...validEvent, reflection: "我今天覺得……" }],
  }),
  );
  assert.equal(denied.status, 400);
});

test("事件 API 拒絕跨站、非 JSON 與超出合理時間窗的請求", async () => {
  const api = createEventsApi({
    repository: {
      countRecentAnonymousEvents: async () => 0,
      recordAnonymousEvents: async () => ({ accepted: 1, duplicates: 0 }),
    },
    clock: () => new Date("2026-07-28T08:00:00.000Z"),
  });
  const crossSite = await api.collect(
    eventRequest({ events: [validEvent] }, {
      origin: "https://attacker.invalid",
      "sec-fetch-site": "cross-site",
    }),
  );
  const plainText = await api.collect(
    eventRequest({ events: [validEvent] }, { "content-type": "text/plain" }),
  );
  const future = await api.collect(eventRequest({ events: [{
    ...validEvent,
    occurredAt: "2099-01-01T00:00:00.000Z",
  }] }));

  assert.equal(crossSite.status, 403);
  assert.equal(plainText.status, 415);
  assert.equal(future.status, 400);
});

test("事件 API 依匿名裝置限制一分鐘接收量", async () => {
  let writes = 0;
  const api = createEventsApi({
    repository: {
      countRecentAnonymousEvents: async () => 120,
      recordAnonymousEvents: async () => {
        writes += 1;
        return { accepted: 1, duplicates: 0 };
      },
    },
    clock: () => new Date("2026-07-28T08:00:00.000Z"),
  });
  const response = await api.collect(eventRequest({ events: [validEvent] }));
  assert.equal(response.status, 429);
  assert.equal(writes, 0);
});
