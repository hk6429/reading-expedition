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

test("repository 只取得已發布文章的正文與題目", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async first() {
          return {
            id: "water-001-guided",
            content_key: "2026-07-28-water",
            category: "world",
            difficulty: "guided",
            title: "城市如何分配有限水源？",
            body: '["第一段","第二段"]',
            glossary_json: "[]",
            source_attribution_json: '[{"publisher":"公開資料站"}]',
            reading_minutes: 6,
            version: 1,
          };
        },
        async all() {
          return {
            results: [
              {
                id: "water-001-q1",
                item_type: "comprehension",
                prompt: "文章主要討論什麼？",
                options_json: '["城市用水","海洋生物"]',
                correct_answer: "城市用水",
                rationale: "全文聚焦城市水源。",
                distractor_reasons_json: '{"海洋生物":"文中未提及"}',
                evidence_span_json: '{"paragraph":1,"start":0,"end":3}',
              },
            ],
          };
        },
      };
    },
  };

  const repository = createReadingRepository(db);
  const reading = await repository.getPublishedReading("water-001-guided");

  assert.deepEqual(reading.body, ["第一段", "第二段"]);
  assert.equal(reading.assessment[0].correctAnswer, "城市用水");
  assert.match(calls[0].sql, /publication_status = 'published'/);
  assert.deepEqual(calls[0].bindings, ["water-001-guided"]);
  assert.deepEqual(calls[1].bindings, ["water-001-guided"]);
});

test("repository 列出匿名班級統計並同步停用班級與權杖", async () => {
  const calls = [];
  const batches = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async all() {
          return {
            results: [
              {
                id: "class-001",
                created_at: "2026-07-28T00:00:00Z",
                expires_at: "2027-01-24T00:00:00Z",
                revoked_at: null,
                anonymous_participants: 6,
                valid_readings: 18,
              },
            ],
          };
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return [{ meta: { changes: 1 } }, { meta: { changes: 3 } }];
    },
  };
  const repository = createReadingRepository(db);

  const classrooms = await repository.listClassrooms();
  const revoked = await repository.revokeClassroom(
    "class-001",
    "2026-07-28T01:00:00Z",
  );

  assert.equal(classrooms[0].anonymousParticipants, 6);
  assert.equal(classrooms[0].validReadings, 18);
  assert.equal("classCode" in classrooms[0], false);
  assert.equal(revoked, true);
  assert.match(calls[0].sql, /LEFT JOIN classroom_contributions/);
  assert.match(calls[1].sql, /UPDATE classrooms/);
  assert.match(calls[2].sql, /UPDATE classroom_tokens/);
  assert.equal(batches[0].length, 2);
});
