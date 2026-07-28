import assert from "node:assert/strict";
import test from "node:test";

import { createOfflineCache } from "../../src/storage/offline-cache.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test("最近成功取得的今日文章可離線讀取", () => {
  const cache = createOfflineCache(memoryStorage(), { maxBytes: 10_000 });
  cache.storeDaily({
    date: "2026-07-28",
    readings: [{ id: "reading-1", title: "今日讀卷" }],
  });
  cache.storeReading({ id: "reading-1", title: "今日讀卷", body: [] });

  assert.equal(cache.getDaily("2026-07-28").readings[0].id, "reading-1");
  assert.equal(cache.getReading("reading-1").title, "今日讀卷");
});

test("空間不足先移除可下載圖片，不刪閱讀資料", () => {
  const cache = createOfflineCache(memoryStorage(), { maxBytes: 500 });
  cache.storeReading({
    id: "reading-1",
    title: "今日讀卷",
    body: [{ text: "不可刪除的閱讀進度與正文" }],
  });
  cache.storeImage("large-art", "x".repeat(1_000));

  assert.equal(cache.getImage("large-art"), null);
  assert.equal(cache.getReading("reading-1").title, "今日讀卷");
});

test("下架文章不供新下載，既有裝置顯示下架狀態", () => {
  const cache = createOfflineCache(memoryStorage(), { maxBytes: 10_000 });
  cache.storeReading({ id: "reading-1", title: "今日讀卷", body: [] });
  cache.markWithdrawn("reading-1");

  assert.equal(cache.canDownload("reading-1"), false);
  assert.equal(cache.getReading("reading-1").withdrawn, true);
});
