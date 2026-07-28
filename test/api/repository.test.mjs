import assert from "node:assert/strict";
import test from "node:test";

import { createReadingRepository } from "../../worker/src/db/repository.js";

function createFakeDb(rows) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async all() {
          return { results: rows };
        },
      };
    },
  };
}

test("repository 依日期取得已發布文章並解析結構欄位", async () => {
  const db = createFakeDb([
    {
      id: "water-001-guided",
      content_key: "2026-07-28-water",
      category: "world",
      difficulty: "guided",
      title: "城市如何分配有限水源？",
      glossary_json: '[{"term":"水權","definition":"使用水資源的權利"}]',
      source_attribution_json: '[{"publisher":"公開資料站"}]',
      version: 1,
    },
  ]);
  const repository = createReadingRepository(db);

  const readings = await repository.getPublishedDaily("2026-07-28");

  assert.equal(readings.length, 1);
  assert.deepEqual(readings[0].glossary, [
    { term: "水權", definition: "使用水資源的權利" },
  ]);
  assert.deepEqual(readings[0].sourceAttribution, [
    { publisher: "公開資料站" },
  ]);
  assert.match(db.calls[0].sql, /publication_status = 'published'/);
  assert.deepEqual(db.calls[0].bindings, ["2026-07-28"]);
});
