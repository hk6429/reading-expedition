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
            level: "launch",
            supportMode: "guided",
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
  assert.equal(payload.readings[0].level, "launch");
  assert.equal(payload.readings[0].supportMode, "guided");
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

test("level 清單 API 回傳 metadata 分頁且不洩漏正文或答案", async () => {
  const calls = [];
  const api = createApi({
    repository: {
      getPublishedDaily: async () => [],
      async listPublishedReadings(query) {
        calls.push(query);
        return {
          total: 201,
          readings: [
            {
              id: "launch-001-guided",
              contentKey: "launch-001",
              category: "world",
              difficulty: "guided",
              level: "launch",
              supportMode: "guided",
              textType: "vernacular",
              title: "第一卷",
              hookQuestion: "這件事如何發生？",
              readingMinutes: 5,
              version: 1,
              body: ["不可外流"],
            },
          ],
        };
      },
    },
  });
  const response = await api.fetch(
    new Request(
      "https://example.test/api/v1/readings?level=launch&page=1&pageSize=200",
    ),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ level: "launch", limit: 200, offset: 0 }]);
  assert.equal(payload.pagination.total, 201);
  assert.equal(payload.pagination.hasMore, true);
  assert.equal(payload.readings[0].level, "launch");
  assert.doesNotMatch(JSON.stringify(payload), /body|correctAnswer/);
});

test("level 清單 API 限制階段與每頁最多 200 筆", async () => {
  const api = createApi({
    repository: {
      getPublishedDaily: async () => [],
      listPublishedReadings: async () => ({ readings: [], total: 0 }),
    },
  });
  const response = await api.fetch(
    new Request(
      "https://example.test/api/v1/readings?level=unknown&pageSize=201",
    ),
  );
  assert.equal(response.status, 400);
});

test("指定日期尚無內容時沿用最近一次完整讀卷，不受七日視窗限制", async () => {
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
              level: "launch",
              supportMode: "guided",
              hookQuestion: "分配一樣多，就是公平嗎？",
              title: "城市如何分配有限水源？",
              body: ["清晨，水庫的刻度又下降了一格。"],
              glossary: [],
              readingStrategy: {
                name: "因果證據鏈閱讀法",
                purpose: "先找水量下降的原因，再核對每一項分配主張依據的證據。",
                steps: [
                  {
                    label: "找變化",
                    instruction: "圈出水量、需求與規則出現變化的位置，先不急著判斷。",
                    example: "水庫刻度下降是現象，還要繼續尋找造成下降的條件。",
                  },
                  {
                    label: "連因果",
                    instruction: "把原因、影響與回應措施用箭頭連起來，檢查是否跳步。",
                    example: "水量減少導向分配壓力，分配規則則會影響不同用水者。",
                  },
                  {
                    label: "核證據",
                    instruction: "回到原文核對每個推論，區分文章明說與自己補上的想法。",
                    example: "若正文只說刻度下降，就不能直接斷定是某一類用戶浪費。",
                  },
                ],
                structureMap:
                  "文章先呈現水源下降的問題，再比較不同分配原則，最後提出可檢驗的判準。",
                expertTip:
                  "看見公平二字先別選邊，先確認文章比較的是規則相同，還是結果與需求相稱。",
                selfCheck:
                  "我的結論是否能指出原文中的原因、影響與直接證據？",
              },
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
  assert.equal(payload.reading.level, "launch");
  assert.equal(payload.reading.supportMode, "guided");
  assert.equal(payload.reading.body[0], "清晨，水庫的刻度又下降了一格。");
  assert.equal(payload.reading.readingStrategy.name, "因果證據鏈閱讀法");
  assert.equal(payload.reading.assessment[0].prompt, "文章主要討論什麼？");
  assert.doesNotMatch(JSON.stringify(payload), /correctAnswer|rationale/);
});
