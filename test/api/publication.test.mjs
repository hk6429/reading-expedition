import assert from "node:assert/strict";
import test from "node:test";

import { createPublicationApi } from "../../worker/src/api/publication.js";

function publicationRepository(overrides = {}) {
  const events = [];
  const packageRecord = {
    id: "water-guided",
    publicationStatus: "review",
    hardGateStatus: "passed",
    qualityScore: 94,
    version: 2,
    ...overrides,
  };
  return {
    events,
    async getReviewPackage() {
      return packageRecord;
    },
    async transitionPublication(id, transition) {
      if (transition.expectedVersion !== packageRecord.version) return null;
      return {
        ...packageRecord,
        publicationStatus: transition.status,
        version: packageRecord.version + 1,
      };
    },
    async appendReviewEvent(event) {
      events.push(event);
    },
  };
}

test("退回必須選原因碼，可附短備註", async () => {
  const repository = publicationRepository();
  const api = createPublicationApi({ repository });
  const missingReason = await api.act(
    "water-guided",
    new Request("https://example.test/action", {
      method: "POST",
      body: JSON.stringify({ action: "returned", expectedVersion: 2 }),
    }),
    "teacher-session",
  );
  const returned = await api.act(
    "water-guided",
    new Request("https://example.test/action", {
      method: "POST",
      body: JSON.stringify({
        action: "returned",
        expectedVersion: 2,
        reasonCode: "evidence_gap",
        note: "請補第二來源。",
      }),
    }),
    "teacher-session",
  );

  assert.equal(missingReason.status, 400);
  assert.equal(returned.status, 200);
  assert.equal(repository.events[0].reasonCode, "evidence_gap");
});

test("發布必須通過硬門檻且品質至少 92 分", async () => {
  const api = createPublicationApi({
    repository: publicationRepository({ qualityScore: 91 }),
  });
  const response = await api.act(
    "water-guided",
    new Request("https://example.test/action", {
      method: "POST",
      body: JSON.stringify({ action: "published", expectedVersion: 2 }),
    }),
    "teacher-session",
  );

  assert.equal(response.status, 422);
});

test("發布建立含前後雜湊的不可變更稽核事件", async () => {
  const repository = publicationRepository();
  const api = createPublicationApi({ repository });
  const response = await api.act(
    "water-guided",
    new Request("https://example.test/action", {
      method: "POST",
      body: JSON.stringify({ action: "published", expectedVersion: 2 }),
    }),
    "teacher-session",
  );

  assert.equal(response.status, 200);
  assert.equal(repository.events[0].action, "published");
  assert.match(repository.events[0].beforeHash, /^[A-Za-z0-9_-]{43}$/);
  assert.match(repository.events[0].afterHash, /^[A-Za-z0-9_-]{43}$/);
});
