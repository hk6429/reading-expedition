import assert from "node:assert/strict";
import test from "node:test";

import { downloadOfflinePack } from "../../src/storage/offline-pack.js";

test("離線週包優先保存正文，最多七篇並逐篇回報失敗", async () => {
  const saved = [];
  const readings = Array.from({ length: 9 }, (_, index) => ({
    id: `reading-${index + 1}`,
    title: `文章 ${index + 1}`,
  }));
  const result = await downloadOfflinePack(readings, {
    loadReading: async (id) =>
      id === "reading-3" ? null : { id, title: id, body: ["正文"] },
    storeReading: (reading) => saved.push(reading.id),
    limit: 7,
  });

  assert.equal(result.requested, 7);
  assert.equal(result.saved, 6);
  assert.deepEqual(result.failed, ["reading-3"]);
  assert.equal(saved.includes("reading-8"), false);
});

test("單篇下載逾時後繼續保存下一篇並逐篇更新進度", async () => {
  const progress = [];
  const result = await downloadOfflinePack(
    [{ id: "stalled" }, { id: "available" }],
    {
      loadReading: async (id) =>
        id === "stalled"
          ? new Promise(() => {})
          : { id, title: "可下載", body: ["正文"] },
      storeReading: () => true,
      timeoutMs: 10,
      onProgress: (value) => progress.push(value),
    },
  );

  assert.deepEqual(result, {
    requested: 2,
    saved: 1,
    failed: ["stalled"],
  });
  assert.deepEqual(
    progress.map(({ completed, saved }) => [completed, saved]),
    [[1, 0], [2, 1]],
  );
});
