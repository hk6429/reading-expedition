import assert from "node:assert/strict";
import test from "node:test";

import { createOfflineCache } from "../../src/storage/offline-cache.js";
import { evaluateHardGates } from "../../worker/src/pipeline/hard-gates.js";

test("來源失效或授權改變時不得發布", () => {
  const otherwiseValid = {
    sourceTraceable: true,
    licenseClear: true,
    factPackVerified: true,
    twoDifficultiesShareFacts: true,
    similarity: 0.2,
    assessmentValid: true,
    readingLevelValid: true,
    contentProfileValid: true,
    schemaValid: true,
  };
  assert.equal(
    evaluateHardGates({ ...otherwiseValid, sourceTraceable: false }).passed,
    false,
  );
  assert.equal(
    evaluateHardGates({ ...otherwiseValid, licenseClear: false }).passed,
    false,
  );
});

test("內容下架後拒絕新下載，但保留既有閱讀紀錄", () => {
  const values = new Map();
  const cache = createOfflineCache({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  cache.storeReading({ id: "withdrawn-1", title: "舊讀卷" });
  cache.markWithdrawn("withdrawn-1");
  assert.equal(cache.canDownload("withdrawn-1"), false);
  assert.equal(cache.getReading("withdrawn-1").withdrawn, true);
});
