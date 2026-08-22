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
  completionProof: "eyJwYXNzZWQiOnRydWV9.c2lnbmF0dXJl",
  readingId: "water-sharing-guided-v1",
  contentKey: "water-sharing",
  version: 1,
  quality: {
    firstCorrect: 2,
    revisedCorrect: 1,
    evidenceViewed: true,
    transferCompleted: false,
  },
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

test("拒絕客戶端自稱有效、能力與週次等可偽造欄位", () => {
  const queue = createClassContributionQueue(memoryStorage());
  assert.throws(
    () => queue.enqueue({ ...contribution, validReading: true }),
    /not allowed/,
  );
  assert.throws(
    () => queue.enqueue({ ...contribution, category: "world" }),
    /not allowed/,
  );
  assert.throws(
    () => queue.enqueue({ ...contribution, period: "2026-W31" }),
    /not allowed/,
  );
});

test("相同 canonical 文章即使版本不同也不重複排入", () => {
  const queue = createClassContributionQueue(memoryStorage());
  queue.enqueue(contribution);
  queue.enqueue({
    ...contribution,
    completionProof: "eyJwYXNzZWQiOnRydWV9.bmV3c2lnbmF0dXJl",
    readingId: "water-sharing-independent-v2",
    version: 2,
  });
  assert.equal(queue.list().length, 1);
});

test("轉化選擇可在送出前更新結構化品質資料", () => {
  const queue = createClassContributionQueue(memoryStorage());
  queue.enqueue(contribution);
  assert.equal(queue.updateQuality("water-sharing", {
    transferCompleted: true,
  }), true);
  assert.equal(queue.list()[0].quality.transferCompleted, true);
  assert.throws(
    () => queue.updateQuality("water-sharing", { reflection: "自由文字" }),
    /quality/,
  );
});
