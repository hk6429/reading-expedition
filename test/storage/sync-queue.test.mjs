import assert from "node:assert/strict";
import test from "node:test";

import { createSyncQueue } from "../../src/storage/sync-queue.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test("未送出事件留在本機，恢復連線後每筆只同步一次", async () => {
  const queue = createSyncQueue(memoryStorage());
  queue.enqueue({
    id: "event-1",
    type: "reading_completed",
    createdAt: "2026-07-28T08:00:00Z",
    context: {
      contentId: "reading-1",
      category: "science",
      difficulty: "guided",
      durationBucket: "6-10m",
      deviceId: "anon-1",
    },
  });
  const sent = [];

  await queue.flush(async (event) => {
    sent.push(event.id);
    return true;
  });
  await queue.flush(async (event) => {
    sent.push(event.id);
    return true;
  });

  assert.deepEqual(sent, ["event-1"]);
  assert.equal(queue.list().length, 0);
});

test("佇列拒絕作答文字、反思、姓名與額外欄位", () => {
  const queue = createSyncQueue(memoryStorage());
  assert.throws(
    () =>
      queue.enqueue({
        id: "event-1",
        type: "reading_completed",
        createdAt: "2026-07-28T08:00:00Z",
        answerText: "我的答案",
        context: { contentId: "reading-1" },
      }),
    /not allowed/,
  );
  assert.throws(
    () =>
      queue.enqueue({
        id: "event-2",
        type: "reading_completed",
        createdAt: "2026-07-28T08:00:00Z",
        context: { contentId: "reading-1", studentName: "小明" },
      }),
    /not allowed/,
  );
});
