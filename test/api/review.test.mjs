import assert from "node:assert/strict";
import test from "node:test";

import { createReviewApi } from "../../worker/src/api/review.js";

function reviewRepository() {
  const packageRecord = {
    id: "water-guided",
    contentKey: "2026-07-28-world-water",
    difficulty: "guided",
    title: "一滴水的旅程",
    hookQuestion: "城市如何分配水？",
    body: [{ id: "p1", text: "水資源需要公平分配。" }],
    glossary: [],
    readingMinutes: 8,
    sourceAttribution: [
      { publisher: "公開資料站", url: "https://source.test/water", license: "CC BY" },
    ],
    qualityScore: 94,
    hardGateStatus: "passed",
    publicationStatus: "review",
    version: 2,
    facts: [{ claim: "水資源分配需要兼顧基本需求。", sourceItemId: "s1" }],
    assessment: [
      {
        id: "q1",
        type: "evidence",
        prompt: "哪句能支持答案？",
        correctAnswer: "水資源需要公平分配。",
        rationale: "正文直接說明。",
        evidenceSpan: { paragraph: 1, start: 0, end: 11 },
      },
    ],
  };
  return {
    async listReviewPackages(status) {
      assert.equal(status, "review");
      return [packageRecord];
    },
    async getReviewPackage(id) {
      return id === packageRecord.id ? packageRecord : null;
    },
    async updateReviewPackage(id, changes, expectedVersion) {
      if (expectedVersion !== packageRecord.version) return null;
      return {
        ...packageRecord,
        ...changes,
        version: expectedVersion + 1,
      };
    },
    async appendReviewEvent(event) {
      return event;
    },
  };
}

test("校閱清單可依狀態篩選並顯示雙難度配對資訊", async () => {
  const api = createReviewApi({ repository: reviewRepository() });
  const response = await api.list(
    new Request("https://example.test/api/v1/teacher/review?status=review"),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.packages[0].contentKey, "2026-07-28-world-water");
  assert.equal(payload.packages[0].difficulty, "guided");
  assert.equal(payload.packages[0].qualityScore, 94);
});

test("校閱詳情包含來源授權、事實、答案、理由與文證", async () => {
  const api = createReviewApi({ repository: reviewRepository() });
  const response = await api.detail("water-guided");
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.package.sourceAttribution[0].license, "CC BY");
  assert.equal(payload.package.facts[0].sourceItemId, "s1");
  assert.equal(payload.package.assessment[0].correctAnswer, "水資源需要公平分配。");
  assert.equal(payload.package.assessment[0].evidenceSpan.paragraph, 1);
});

test("教師修改必須帶版本，衝突時不靜默覆寫", async () => {
  const api = createReviewApi({ repository: reviewRepository() });
  const conflict = await api.update(
    "water-guided",
    new Request("https://example.test/api/v1/teacher/review/water-guided", {
      method: "PATCH",
      body: JSON.stringify({ expectedVersion: 1, title: "新版標題" }),
    }),
    "teacher-session",
  );
  const updated = await api.update(
    "water-guided",
    new Request("https://example.test/api/v1/teacher/review/water-guided", {
      method: "PATCH",
      body: JSON.stringify({ expectedVersion: 2, title: "新版標題" }),
    }),
    "teacher-session",
  );

  assert.equal(conflict.status, 409);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).package.version, 3);
});

test("批次操作不能變更或核准答案", async () => {
  const api = createReviewApi({ repository: reviewRepository() });
  const response = await api.batch(
    new Request("https://example.test/api/v1/teacher/review/batch", {
      method: "POST",
      body: JSON.stringify({
        ids: ["water-guided"],
        action: "approved",
        correctAnswer: "不可批次變更",
      }),
    }),
  );

  assert.equal(response.status, 400);
});
