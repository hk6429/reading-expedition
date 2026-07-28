import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../../worker/src/api/router.js";

test("daily API 只回已發布閱讀摘要且不洩漏答案", async () => {
  const requestedDates = [];
  const api = createApi({
    clock: () => new Date("2026-07-28T01:30:00.000Z"),
    repository: {
      async getPublishedDaily(date) {
        requestedDates.push(date);
        return [
          {
            id: "water-001-guided",
            contentKey: "2026-07-28-water",
            category: "world",
            difficulty: "guided",
            title: "城市如何分配有限水源？",
            hookQuestion: "如果水不夠，每個人都該一樣多嗎？",
            readingMinutes: 6,
            version: 1,
          },
        ];
      },
    },
  });

  const response = await api.fetch(
    new Request("https://example.test/api/v1/daily"),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=300");
  assert.match(response.headers.get("x-trace-id"), /^[a-f0-9-]{36}$/);
  assert.deepEqual(requestedDates, ["2026-07-28"]);
  assert.equal(payload.date, "2026-07-28");
  assert.equal(payload.readings[0].title, "城市如何分配有限水源？");
  assert.doesNotMatch(JSON.stringify(payload), /correctAnswer|答案|rationale/);
});

test("daily API 拒絕無效日期並回傳一致錯誤", async () => {
  const api = createApi({
    repository: { getPublishedDaily: async () => [] },
  });

  const response = await api.fetch(
    new Request("https://example.test/api/v1/daily?date=2026-02-31"),
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(payload.error, {
    code: "invalid_date",
    message: "日期必須使用有效的 YYYY-MM-DD 格式。",
  });
});

test("指定日期尚無內容時沿用七日內最近一次完整讀卷", async () => {
  const requestedDates = [];
  const api = createApi({
    repository: {
      async getPublishedDaily(date) {
        requestedDates.push(["exact", date]);
        return [];
      },
      async getLatestPublishedDaily(date) {
        requestedDates.push(["latest", date]);
        return [
          {
            id: "water-001-guided",
            contentKey: "2026-07-28-water",
            topicDate: "2026-07-28",
            category: "world",
            difficulty: "guided",
            textType: "plain",
            title: "城市如何分配有限水源？",
            hookQuestion: "如果水不夠，每個人都該一樣多嗎？",
            readingMinutes: 6,
            version: 1,
          },
        ];
      },
    },
  });

  const response = await api.fetch(
    new Request("https://example.test/api/v1/daily?date=2026-07-29"),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(requestedDates, [
    ["exact", "2026-07-29"],
    ["latest", "2026-07-29"],
  ]);
  assert.equal(payload.date, "2026-07-29");
  assert.equal(payload.contentDate, "2026-07-28");
  assert.equal(payload.isEncore, true);
  assert.equal(payload.readings[0].id, "water-001-guided");
});

test("reading API 提供正文與題目外觀，但不提供答案", async () => {
  const api = createApi({
    repository: {
      getPublishedDaily: async () => [],
      getPublishedReading: async (id) =>
        id === "water-001-guided"
          ? {
              id,
              contentKey: "2026-07-28-water",
              category: "world",
              difficulty: "guided",
              hookQuestion: "分配一樣多，就是公平嗎？",
              title: "城市如何分配有限水源？",
              body: ["清晨，水庫的刻度又下降了一格。"],
              glossary: [],
              sourceAttribution: [{ publisher: "公開資料站" }],
              readingMinutes: 6,
              version: 1,
              assessment: [
                {
                  id: "water-001-q1",
                  type: "comprehension",
                  prompt: "文章主要討論什麼？",
                  options: ["城市用水", "海洋生物", "森林保育", "太空探索"],
                  correctAnswer: "城市用水",
                  rationale: "全文都在討論城市水源。",
                },
              ],
            }
          : null,
    },
  });

  const response = await api.fetch(
    new Request("https://example.test/api/v1/readings/water-001-guided"),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.reading.hookQuestion, "分配一樣多，就是公平嗎？");
  assert.equal(payload.reading.body[0], "清晨，水庫的刻度又下降了一格。");
  assert.equal(payload.reading.assessment[0].prompt, "文章主要討論什麼？");
  assert.doesNotMatch(JSON.stringify(payload), /correctAnswer|rationale/);
});
