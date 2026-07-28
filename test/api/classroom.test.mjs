import assert from "node:assert/strict";
import test from "node:test";

import { createClassroomApi } from "../../worker/src/api/classroom.js";

function repository() {
  const classrooms = new Map();
  const classroomsById = new Map();
  const tokens = new Map();
  const contributions = [];
  return {
    classrooms,
    classroomsById,
    tokens,
    contributions,
    async createClassroom(record) {
      classrooms.set(record.classCodeHash, record);
      classroomsById.set(record.id, record);
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
    async listClassrooms() {
      return [...classroomsById.values()].map((record) => ({
        id: record.id,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        revokedAt: record.revokedAt ?? null,
        anonymousParticipants: 0,
        validReadings: 0,
      }));
    },
    async revokeClassroom(classroomId, revokedAt) {
      const classroom = classroomsById.get(classroomId);
      if (!classroom || classroom.revokedAt) return false;
      classroom.revokedAt = revokedAt;
      for (const token of tokens.values()) {
        if (token.classroomId === classroomId) token.revokedAt = revokedAt;
      }
      return true;
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

test("教師可列出班級統計並停用班級與既有參與權杖", async () => {
  const repo = repository();
  const clock = () => new Date("2026-07-28T00:00:00.000Z");
  const api = createClassroomApi({ repository: repo, clock });
  const created = await api.create("teacher-session");
  const createdPayload = await created.json();
  const joined = await api.join(
    new Request("https://example.test/join", {
      method: "POST",
      body: JSON.stringify({ classCode: createdPayload.classCode }),
    }),
  );
  const { participantToken } = await joined.json();

  const listed = await api.list();
  const listPayload = await listed.json();
  const revoked = await api.revoke(createdPayload.id);
  const rejected = await api.landmark(
    new Request("https://example.test/landmark", {
      headers: { authorization: `Bearer ${participantToken}` },
    }),
  );

  assert.equal(createdPayload.createdAt, "2026-07-28T00:00:00.000Z");
  assert.equal(listPayload.classrooms.length, 1);
  assert.equal(listPayload.classrooms[0].id, createdPayload.id);
  assert.equal(revoked.status, 200);
  assert.equal(rejected.status, 401);
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
        contentId: "water-sharing-guided-v1",
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
