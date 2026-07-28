import assert from "node:assert/strict";
import test from "node:test";

import { createClassroomApi } from "../../worker/src/api/classroom.js";

function repository() {
  const classrooms = new Map();
  const tokens = new Map();
  const contributions = [];
  return {
    classrooms,
    tokens,
    contributions,
    async createClassroom(record) {
      classrooms.set(record.classCodeHash, record);
    },
    async findClassroomByCodeHash(hash) {
      return classrooms.get(hash) ?? null;
    },
    async createClassroomToken(record) {
      tokens.set(record.tokenHash, record);
    },
    async findClassroomToken(hash) {
      return tokens.get(hash) ?? null;
    },
    async addClassContribution(record) {
      contributions.push(record);
    },
    async getClassAggregate(classroomId) {
      return {
        classroomId,
        anonymousParticipants: contributions.length < 5 ? 3 : 5,
        validReadings: contributions.length,
        categoryDistribution: { science: contributions.length },
        skillDistribution: { evidence: contributions.length },
      };
    },
  };
}

test("教師建立隨機班級碼，伺服器只保存雜湊", async () => {
  const repo = repository();
  const api = createClassroomApi({ repository: repo });
  const response = await api.create("teacher-session");
  const { classCode } = await response.json();

  assert.match(classCode, /^[A-Z2-9]{8}$/);
  assert.equal(repo.classrooms.has(classCode), false);
  assert.equal(repo.classrooms.size, 1);
});

test("學生以班級碼取得匿名權杖並只上傳結構化貢獻", async () => {
  const repo = repository();
  const api = createClassroomApi({ repository: repo });
  const created = await api.create("teacher-session");
  const { classCode } = await created.json();
  const joined = await api.join(
    new Request("https://example.test/join", {
      method: "POST",
      body: JSON.stringify({ classCode }),
    }),
  );
  const { participantToken } = await joined.json();
  const contributed = await api.contribute(
    new Request("https://example.test/contribute", {
      method: "POST",
      headers: { authorization: `Bearer ${participantToken}` },
      body: JSON.stringify({
        validReading: true,
        category: "science",
        skill: "evidence",
        period: "2026-W31",
      }),
    }),
  );

  assert.equal(joined.status, 201);
  assert.equal(repo.tokens.has(participantToken), false);
  assert.equal(contributed.status, 202);
});

test("未達五人隱私門檻不顯示細分統計或個人貢獻", async () => {
  const repo = repository();
  const api = createClassroomApi({ repository: repo, privacyThreshold: 5 });
  const created = await api.create("teacher-session");
  const { classCode } = await created.json();
  const joined = await api.join(
    new Request("https://example.test/join", {
      method: "POST",
      body: JSON.stringify({ classCode }),
    }),
  );
  const { participantToken } = await joined.json();
  const response = await api.landmark(
    new Request("https://example.test/landmark", {
      headers: { authorization: `Bearer ${participantToken}` },
    }),
  );
  const payload = await response.json();

  assert.equal(payload.privacyProtected, true);
  assert.equal("categoryDistribution" in payload, false);
  assert.equal("individuals" in payload, false);
});
