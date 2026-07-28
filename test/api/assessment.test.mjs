import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../../worker/src/api/router.js";

test("submit API 驗證內容版本並回傳文證回饋", async () => {
  const api = createApi({
    repository: {
      getPublishedDaily: async () => [],
      getAssessmentKey: async (readingId, version) => {
        assert.equal(readingId, "water-sharing-guided-v1");
        assert.equal(version, 1);
        return [
          {
            id: "q1",
            correctAnswer: "基本需要、影響與節水能力",
            rationale: "第三段直接列出三項條件。",
            distractorReasons: {
              只看誰要求得最多:
                "這只採用需求量，忽略基本需要與實際影響。",
            },
            evidenceSpan: { paragraph: 3, start: 0, end: 63 },
          },
        ];
      },
    },
  });

  const response = await api.fetch(
    new Request(
      "https://example.test/api/v1/readings/water-sharing-guided-v1/submit",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: 1,
          answers: { q1: "只看誰要求得最多" },
        }),
      },
    ),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.results[0].correct, false);
  assert.equal(payload.results[0].evidenceSpan.paragraph, 3);
  assert.equal(
    payload.results[0].diagnostic,
    "這只採用需求量，忽略基本需要與實際影響。",
  );
  assert.equal(payload.results[0].correctAnswer, undefined);
  assert.equal(payload.results[0].rationale, undefined);
});

test("submit API 拒絕缺少版本或多餘欄位的 payload", async () => {
  const api = createApi({
    repository: {
      getPublishedDaily: async () => [],
      getAssessmentKey: async () => [],
    },
  });

  const response = await api.fetch(
    new Request("https://example.test/api/v1/readings/reading-1/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: {}, studentName: "不應傳送" }),
    }),
  );

  assert.equal(response.status, 400);
});
