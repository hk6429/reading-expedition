import assert from "node:assert/strict";
import test from "node:test";

import { createClassContributionQueue } from "../../src/storage/class-contribution-queue.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const contribution = {
  validReading: true,
  contentId: "water-sharing-guided-v1",
  category: "world",
  skill: "evidence",
  period: "2026-W31",
};

test("同一篇班級貢獻在離線佇列只保留一次", () => {
  const queue = createClassContributionQueue(memoryStorage());
  queue.enqueue(contribution);
  queue.enqueue(contribution);
  assert.equal(queue.list().length, 1);
});

test("傳送失敗保留、成功移除，退出班級可清空", async () => {
  const queue = createClassContributionQueue(memoryStorage());
  queue.enqueue(contribution);
  await queue.flush(async () => false);
  assert.equal(queue.list().length, 1);
  await queue.flush(async () => true);
  assert.equal(queue.list().length, 0);
  queue.enqueue(contribution);
  queue.clear();
  assert.equal(queue.list().length, 0);
});
