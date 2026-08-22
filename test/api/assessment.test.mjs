import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../../worker/src/api/router.js";
import { createCompletionProofService } from "../../worker/src/api/assessment.js";

function withAssessmentNonceStore(repository) {
  const nonces = new Map();
  return {
    ...repository,
    async createAssessmentStartNonce(record) {
      if (nonces.has(record.nonce)) throw new Error("duplicate nonce");
      nonces.set(record.nonce, record);
    },
    async consumeAssessmentStartNonce(record) {
      const stored = nonces.get(record.nonce);
      if (!stored || stored.consumedAt) return false;
      stored.consumedAt = record.consumedAt;
      return true;
    },
  };
}

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
  assert.equal(payload.passed, false);
  assert.equal("completionProof" in payload, false);
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

test("作答開始時間由伺服器簽章並綁定文章版本", async () => {
  const clock = () => new Date("2026-08-22T10:00:00.000Z");
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
  });
  const api = createApi({
    repository: withAssessmentNonceStore({
      getPublishedDaily: async () => [],
      getAssessmentProofContext: async (readingId, version) => ({
        readingId,
        version,
        contentKey: "water-sharing",
        category: "science",
      }),
    }),
    completionProofService,
    clock,
  });

  const response = await api.fetch(
    new Request(
      "https://example.test/api/v1/readings/water-sharing-guided-v1/assessment-session",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: 1 }),
      },
    ),
  );
  const payload = await response.json();
  const claims = await completionProofService.verifyStart(
    payload.assessmentSession,
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(claims.kind, "assessment_start");
  assert.equal(claims.readingId, "water-sharing-guided-v1");
  assert.equal(claims.contentKey, "water-sharing");
  assert.equal(claims.version, 1);
  assert.equal(claims.issuedAt, "2026-08-22T10:00:00.000Z");
  assert.equal("answers" in claims, false);
});

test("伺服器拒絕不可能完成速度，經過最短時間才簽完成證明", async () => {
  let now = new Date("2026-08-22T10:00:00.000Z");
  const clock = () => new Date(now);
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
    minimumCompletionMs: 30_000,
  });
  const repository = withAssessmentNonceStore({
    getPublishedDaily: async () => [],
    getAssessmentKey: async () => [
      {
        id: "q1",
        type: "evidence",
        correctAnswer: "原文證據",
        rationale: "能回到原文找證據。",
        distractorReasons: {},
        evidenceSpan: { paragraph: 2, start: 0, end: 6 },
      },
    ],
    getAssessmentProofContext: async (readingId, version) => ({
      readingId,
      version,
      contentKey: "water-sharing",
      category: "science",
    }),
  });
  const api = createApi({ repository, completionProofService, clock });
  const sessionResponse = await api.fetch(
    new Request(
      "https://example.test/api/v1/readings/water-sharing-guided-v1/assessment-session",
      {
        method: "POST",
        body: JSON.stringify({ version: 1 }),
      },
    ),
  );
  const { assessmentSession } = await sessionResponse.json();
  const request = () =>
    new Request(
      "https://example.test/api/v1/readings/water-sharing-guided-v1/submit",
      {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          answers: { q1: "原文證據" },
          assessmentSession,
        }),
      },
    );

  const tooFast = await api.fetch(request());
  const tooFastPayload = await tooFast.json();
  assert.equal(tooFast.status, 429);
  assert.equal(tooFastPayload.error.code, "assessment_too_fast");
  assert.equal(
    tooFastPayload.error.message,
    "完成速度超出可驗證範圍，請回到文章閱讀後再試。",
  );

  now = new Date("2026-08-22T10:00:30.000Z");
  const accepted = await api.fetch(request());
  const payload = await accepted.json();
  const claims = await completionProofService.verify(payload.completionProof);

  assert.equal(accepted.status, 200);
  assert.equal(claims.startedAt, "2026-08-22T10:00:00.000Z");
  assert.equal(claims.issuedAt, "2026-08-22T10:00:30.000Z");
});

test("作答達標但未帶伺服器工作階段時只評分、不簽完成證明", async () => {
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
  });
  const api = createApi({
    repository: {
      getPublishedDaily: async () => [],
      getAssessmentKey: async () => [
        {
          id: "q1",
          type: "evidence",
          correctAnswer: "原文證據",
          rationale: "能回到原文找證據。",
          distractorReasons: {},
          evidenceSpan: { paragraph: 2, start: 0, end: 6 },
        },
      ],
      getAssessmentProofContext: async (readingId, version) => ({
        readingId,
        version,
        contentKey: "water-sharing",
        category: "science",
      }),
    },
    completionProofService,
  });

  const response = await api.fetch(
    new Request(
      "https://example.test/api/v1/readings/water-sharing-guided-v1/submit",
      {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          answers: { q1: "原文證據" },
        }),
      },
    ),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.passed, true);
  assert.equal("completionProof" in payload, false);
});

test("作答達標後簽發短效且綁定文章版本與內容鍵的完成證明", async () => {
  let now = new Date("2026-08-22T10:00:00.000Z");
  const clock = () => new Date(now);
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
    ttlMs: 5 * 60_000,
  });
  const api = createApi({
    repository: withAssessmentNonceStore({
      getPublishedDaily: async () => [],
      getAssessmentKey: async () => [
        {
          id: "q1",
          type: "evidence",
          correctAnswer: "原文證據",
          rationale: "能回到原文找證據。",
          distractorReasons: {},
          evidenceSpan: { paragraph: 2, start: 0, end: 6 },
        },
      ],
      getAssessmentProofContext: async (readingId, version) => ({
        readingId,
        version,
        contentKey: "water-sharing",
        category: "science",
      }),
    }),
    completionProofService,
    clock,
  });
  const sessionResponse = await api.fetch(
    new Request(
      "https://example.test/api/v1/readings/water-sharing-guided-v1/assessment-session",
      {
        method: "POST",
        body: JSON.stringify({ version: 1 }),
      },
    ),
  );
  const { assessmentSession } = await sessionResponse.json();
  now = new Date("2026-08-22T10:00:30.000Z");

  const submitRequest = () =>
    new Request(
      "https://example.test/api/v1/readings/water-sharing-guided-v1/submit",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: 1,
          answers: { q1: "原文證據" },
          assessmentSession,
        }),
      },
    );
  const responses = await Promise.all([
    api.fetch(submitRequest()),
    api.fetch(submitRequest()),
  ]);
  assert.deepEqual(
    responses.map(({ status }) => status).sort(),
    [200, 409],
  );
  const response = responses.find(({ status }) => status === 200);
  const replay = responses.find(({ status }) => status === 409);
  const payload = await response.json();
  const replayPayload = await replay.json();
  const claims = await completionProofService.verify(payload.completionProof);

  assert.equal(response.status, 200);
  assert.equal(payload.passed, true);
  assert.equal(claims.readingId, "water-sharing-guided-v1");
  assert.equal(claims.contentKey, "water-sharing");
  assert.equal(claims.version, 1);
  assert.equal(claims.category, "science");
  assert.equal(claims.skill, "evidence");
  assert.equal(claims.passed, true);
  assert.equal(claims.startedAt, "2026-08-22T10:00:00.000Z");
  assert.equal(claims.expiresAt, "2026-08-22T10:05:30.000Z");
  assert.match(claims.nonce, /^[A-Za-z0-9_-]{20,}$/);
  assert.equal("answers" in claims, false);
  assert.equal("name" in claims, false);
  assert.equal(replayPayload.error.code, "assessment_session_replayed");
});
