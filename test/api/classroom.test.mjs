import assert from "node:assert/strict";
import test from "node:test";

import { createClassroomApi } from "../../worker/src/api/classroom.js";
import { createCompletionProofService } from "../../worker/src/api/assessment.js";

function repository() {
  const classrooms = new Map();
  const classroomsById = new Map();
  const tokens = new Map();
  const seats = new Map();
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
      if (record.seatHash) seats.set(`${record.classroomId}:${record.seatHash}`, record);
    },
    async findClassroomTokenBySeatHash(classroomId, seatHash) {
      return seats.get(`${classroomId}:${seatHash}`) ?? null;
    },
    async findClassroomToken(hash) {
      return tokens.get(hash) ?? null;
    },
    async addClassContribution(record) {
      if (
        contributions.some(
          (existing) =>
            existing.proofNonce === record.proofNonce ||
            (existing.participantId === record.participantId &&
              existing.canonicalContentKey === record.canonicalContentKey),
        )
      ) {
        return false;
      }
      contributions.push(record);
      return true;
    },
    async getClassAggregate(classroomId) {
      return {
        classroomId,
        anonymousParticipants: contributions.length < 5 ? 3 : 5,
        weeklyAnonymousParticipants: contributions.length < 5 ? 3 : 5,
        validReadings: contributions.length,
        weeklyValidReadings: contributions.length,
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
    async rotateClassroomCode(classroomId, classCodeHash, rotatedAt) {
      const classroom = classroomsById.get(classroomId);
      if (!classroom || classroom.revokedAt) return false;
      classrooms.delete(classroom.classCodeHash);
      classroom.classCodeHash = classCodeHash;
      classrooms.set(classCodeHash, classroom);
      for (const token of tokens.values()) {
        if (token.classroomId === classroomId) token.revokedAt = rotatedAt;
      }
      return true;
    },
  };
}

async function joinCreatedClassroom(api) {
  const created = await api.create("teacher-session");
  const { classCode } = await created.json();
  const joined = await api.join(
    new Request("https://example.test/join", {
      method: "POST",
      body: JSON.stringify({ classCode, seatToken: "s".repeat(43) }),
    }),
  );
  return (await joined.json()).participantToken;
}

function contributionRequest(participantToken, payload) {
  return new Request("https://example.test/contribute", {
    method: "POST",
    headers: { authorization: `Bearer ${participantToken}` },
    body: JSON.stringify(payload),
  });
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

test("同一裝置席次重複加入不會 mint 新統計身分，教師換碼會撤銷舊席次", async () => {
  const repo = repository();
  const api = createClassroomApi({ repository: repo });
  const created = await api.create("teacher-session");
  const classroom = await created.json();
  const seatToken = "z".repeat(43);
  const join = () => api.join(
    new Request("https://example.test/join", {
      method: "POST",
      body: JSON.stringify({ classCode: classroom.classCode, seatToken }),
    }),
  );
  assert.equal((await join()).status, 201);
  const reused = await join();
  assert.equal(reused.status, 200);
  assert.equal((await reused.json()).reusedSeat, true);
  assert.equal(repo.tokens.size, 1);

  const rotated = await api.rotateCode(classroom.id);
  assert.equal(rotated.status, 200);
  assert.notEqual((await rotated.json()).classCode, classroom.classCode);
  const landmark = await api.landmark(
    new Request("https://example.test/landmark", {
      headers: { authorization: `Bearer ${seatToken}` },
    }),
  );
  assert.equal(landmark.status, 401);
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
      body: JSON.stringify({
        classCode: createdPayload.classCode,
        seatToken: "t".repeat(43),
      }),
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

test("學生持伺服器完成證明後才能上傳結構化班級貢獻", async () => {
  const repo = repository();
  const clock = () => new Date("2026-07-28T12:00:00.000Z");
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
  });
  const api = createClassroomApi({
    repository: repo,
    clock,
    completionProofService,
  });
  const created = await api.create("teacher-session");
  const { classCode } = await created.json();
  const joined = await api.join(
    new Request("https://example.test/join", {
      method: "POST",
      body: JSON.stringify({ classCode, seatToken: "u".repeat(43) }),
    }),
  );
  const { participantToken } = await joined.json();
  const completionProof = await completionProofService.issue({
    readingId: "water-sharing-guided-v1",
    contentKey: "water-sharing",
    version: 1,
    category: "science",
    skill: "evidence",
  });
  const contributed = await api.contribute(
    new Request("https://example.test/contribute", {
      method: "POST",
      headers: { authorization: `Bearer ${participantToken}` },
      body: JSON.stringify({
        completionProof,
        readingId: "water-sharing-guided-v1",
        contentKey: "water-sharing",
        version: 1,
        quality: {
          firstCorrect: 2,
          revisedCorrect: 1,
          evidenceViewed: true,
          transferCompleted: false,
        },
      }),
    }),
  );

  assert.equal(joined.status, 201);
  assert.equal(repo.tokens.has(participantToken), false);
  assert.equal(contributed.status, 202);
  assert.equal(repo.contributions[0].period, "2026-W31");
  assert.equal(repo.contributions[0].canonicalContentKey, "water-sharing");
  assert.equal(repo.contributions[0].category, "science");
  assert.equal(repo.contributions[0].skill, "evidence");
  assert.deepEqual(repo.contributions[0].quality, {
    firstCorrect: 2,
    revisedCorrect: 1,
    revisionOpportunities: 1,
    abilityResults: null,
    evidenceViewed: true,
    transferCompleted: false,
  });
  assert.equal("completionProof" in repo.contributions[0], false);
});

test("未附完成證明的舊版自報有效閱讀會被拒絕", async () => {
  const repo = repository();
  const clock = () => new Date("2026-08-22T10:00:00.000Z");
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
  });
  const api = createClassroomApi({
    repository: repo,
    clock,
    completionProofService,
  });
  const participantToken = await joinCreatedClassroom(api);

  const response = await api.contribute(
    contributionRequest(participantToken, {
      validReading: true,
      contentId: "water-guided-v1",
      category: "science",
      skill: "evidence",
      period: "2026-W34",
    }),
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "invalid_class_contribution");
  assert.equal(repo.contributions.length, 0);
});

test("班級貢獻品質只接受 0 到 3 整數與布林，不接受自由文字", async () => {
  const repo = repository();
  const clock = () => new Date("2026-08-22T10:00:00.000Z");
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
  });
  const api = createClassroomApi({
    repository: repo,
    clock,
    completionProofService,
  });
  const participantToken = await joinCreatedClassroom(api);
  const completionProof = await completionProofService.issue({
    readingId: "water-guided-v1",
    contentKey: "water",
    version: 1,
    category: "science",
    skill: "evidence",
  });

  const response = await api.contribute(
    contributionRequest(participantToken, {
      completionProof,
      readingId: "water-guided-v1",
      contentKey: "water",
      version: 1,
      quality: {
        firstCorrect: 4,
        revisedCorrect: 0,
        evidenceViewed: true,
        transferCompleted: false,
        reflection: "不可上傳",
      },
    }),
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "invalid_class_contribution");
  assert.equal(repo.contributions.length, 0);
});

test("改寫完成證明或證明欄位不一致時拒絕班級貢獻", async () => {
  const repo = repository();
  const clock = () => new Date("2026-08-22T10:00:00.000Z");
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
  });
  const api = createClassroomApi({
    repository: repo,
    clock,
    completionProofService,
  });
  const participantToken = await joinCreatedClassroom(api);
  const completionProof = await completionProofService.issue({
    readingId: "water-guided-v1",
    contentKey: "water",
    version: 1,
    category: "science",
    skill: "evidence",
  });
  const [encodedClaims, signature] = completionProof.split(".");
  const replacement = signature.startsWith("A") ? "B" : "A";
  const tampered = await api.contribute(
    contributionRequest(participantToken, {
      completionProof: `${encodedClaims}.${replacement}${signature.slice(1)}`,
      readingId: "water-guided-v1",
      contentKey: "water",
      version: 1,
    }),
  );
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const finalIndex = alphabet.indexOf(signature.at(-1));
  assert.equal(finalIndex % 4, 0, "HMAC base64url 尾字元應使用 canonical bits");
  const nonCanonical = await api.contribute(
    contributionRequest(participantToken, {
      completionProof: `${encodedClaims}.${signature.slice(0, -1)}${alphabet[finalIndex + 1]}`,
      readingId: "water-guided-v1",
      contentKey: "water",
      version: 1,
    }),
  );
  const mismatch = await api.contribute(
    contributionRequest(participantToken, {
      completionProof,
      readingId: "water-guided-v1",
      contentKey: "different-content",
      version: 1,
    }),
  );

  assert.equal(tampered.status, 400);
  assert.equal((await tampered.json()).error.code, "completion_proof_invalid");
  assert.equal(nonCanonical.status, 400);
  assert.equal(
    (await nonCanonical.json()).error.code,
    "completion_proof_invalid",
  );
  assert.equal(mismatch.status, 400);
  assert.equal((await mismatch.json()).error.code, "completion_proof_mismatch");
  assert.equal(repo.contributions.length, 0);
});

test("完成證明到期後回傳 400 且不寫入貢獻", async () => {
  const repo = repository();
  let now = new Date("2026-08-22T10:00:00.000Z");
  const clock = () => new Date(now);
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
    ttlMs: 60_000,
  });
  const api = createClassroomApi({
    repository: repo,
    clock,
    completionProofService,
  });
  const participantToken = await joinCreatedClassroom(api);
  const completionProof = await completionProofService.issue({
    readingId: "water-guided-v1",
    contentKey: "water",
    version: 1,
    category: "science",
    skill: "evidence",
  });
  now = new Date("2026-08-22T10:01:01.000Z");

  const response = await api.contribute(
    contributionRequest(participantToken, {
      completionProof,
      readingId: "water-guided-v1",
      contentKey: "water",
      version: 1,
    }),
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "completion_proof_expired");
  assert.equal(repo.contributions.length, 0);
});

test("班級貢獻依簽章內的伺服器時間拒絕不可能完成速度", async () => {
  const repo = repository();
  const clock = () => new Date("2026-08-22T10:00:00.000Z");
  const secret = "test-only-completion-proof-secret-32-bytes";
  const relaxedIssuer = createCompletionProofService({
    secret,
    clock,
    minimumCompletionMs: 0,
  });
  const strictVerifier = createCompletionProofService({
    secret,
    clock,
    minimumCompletionMs: 30_000,
  });
  const api = createClassroomApi({
    repository: repo,
    clock,
    completionProofService: strictVerifier,
  });
  const participantToken = await joinCreatedClassroom(api);
  const completionProof = await relaxedIssuer.issue({
    readingId: "water-guided-v1",
    contentKey: "water",
    version: 1,
    category: "science",
    skill: "evidence",
    startedAt: "2026-08-22T09:59:55.000Z",
  });

  const response = await api.contribute(
    contributionRequest(participantToken, {
      completionProof,
      readingId: "water-guided-v1",
      contentKey: "water",
      version: 1,
    }),
  );

  assert.equal(response.status, 429);
  assert.equal(
    (await response.json()).error.code,
    "class_contribution_too_fast",
  );
  assert.equal(repo.contributions.length, 0);
});

test("nonce 重播與同篇不同模式都回傳 409 且只計一次", async () => {
  const repo = repository();
  const clock = () => new Date("2026-08-22T10:00:00.000Z");
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
  });
  const api = createClassroomApi({
    repository: repo,
    clock,
    completionProofService,
  });
  const participantToken = await joinCreatedClassroom(api);
  const firstProof = await completionProofService.issue({
    readingId: "water-guided-v1",
    contentKey: "water",
    version: 1,
    category: "science",
    skill: "evidence",
  });
  const firstPayload = {
    completionProof: firstProof,
    readingId: "water-guided-v1",
    contentKey: "water",
    version: 1,
  };

  const accepted = await api.contribute(
    contributionRequest(participantToken, firstPayload),
  );
  const replayed = await api.contribute(
    contributionRequest(participantToken, firstPayload),
  );
  const secondProof = await completionProofService.issue({
    readingId: "water-independent-v2",
    contentKey: "water",
    version: 2,
    category: "science",
    skill: "inference",
  });
  const duplicateContent = await api.contribute(
    contributionRequest(participantToken, {
      completionProof: secondProof,
      readingId: "water-independent-v2",
      contentKey: "water",
      version: 2,
    }),
  );

  assert.equal(accepted.status, 202);
  assert.equal(replayed.status, 409);
  assert.equal(duplicateContent.status, 409);
  assert.equal(repo.contributions.length, 1);
});

test("匿名權杖一分鐘已有三份有效閱讀時，第 4 份回傳 429", async () => {
  const repo = repository();
  repo.countRecentClassContributions = async (participantId, since) => {
    assert.match(participantId, /^[0-9a-f-]{36}$/);
    assert.equal(since, "2026-08-22T09:59:00.000Z");
    return 3;
  };
  const clock = () => new Date("2026-08-22T10:00:00.000Z");
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
  });
  const api = createClassroomApi({
    repository: repo,
    clock,
    completionProofService,
    contributionRateLimit: 3,
  });
  const participantToken = await joinCreatedClassroom(api);
  const completionProof = await completionProofService.issue({
    readingId: "water-guided-v1",
    contentKey: "water",
    version: 1,
    category: "science",
    skill: "evidence",
  });

  const response = await api.contribute(
    contributionRequest(participantToken, {
      completionProof,
      readingId: "water-guided-v1",
      contentKey: "water",
      version: 1,
    }),
  );

  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "class_contribution_limited");
  assert.equal(repo.contributions.length, 0);
});

test("班級一分鐘貢獻達群體上限時於寫入前回傳 429", async () => {
  const repo = repository();
  repo.countRecentClassroomContributions = async (classroomId, since) => {
    assert.match(classroomId, /^[0-9a-f-]{36}$/);
    assert.equal(since, "2026-08-22T09:59:00.000Z");
    return 120;
  };
  const clock = () => new Date("2026-08-22T10:00:00.000Z");
  const completionProofService = createCompletionProofService({
    secret: "test-only-completion-proof-secret-32-bytes",
    clock,
  });
  const api = createClassroomApi({
    repository: repo,
    clock,
    completionProofService,
    classroomContributionRateLimit: 120,
  });
  const participantToken = await joinCreatedClassroom(api);

  const response = await api.contribute(
    contributionRequest(participantToken, {
      completionProof: `${"a".repeat(40)}.${"b".repeat(43)}`,
      readingId: "water-guided-v1",
      contentKey: "water",
      version: 1,
    }),
  );

  assert.equal(response.status, 429);
  assert.equal(
    (await response.json()).error.code,
    "classroom_contribution_limited",
  );
  assert.equal(repo.contributions.length, 0);
});

test("班級地標分開回傳永久累積與本週任務進度", async () => {
  const repo = repository();
  let requestedPeriod = null;
  repo.getClassAggregate = async (classroomId, period) => {
    requestedPeriod = period;
    return {
      classroomId,
      anonymousParticipants: 6,
      validReadings: 24,
      weeklyAnonymousParticipants: 5,
      weeklyValidReadings: 7,
      categoryDistribution: { science: 4, humanities: 3 },
      skillDistribution: { evidence: 7 },
    };
  };
  const clock = () => new Date("2026-07-28T12:00:00.000Z");
  const api = createClassroomApi({
    repository: repo,
    clock,
    privacyThreshold: 5,
  });
  const created = await api.create("teacher-session");
  const { classCode } = await created.json();
  const joined = await api.join(
    new Request("https://example.test/join", {
      method: "POST",
      body: JSON.stringify({ classCode, seatToken: "v".repeat(43) }),
    }),
  );
  const { participantToken } = await joined.json();

  const response = await api.landmark(
    new Request("https://example.test/landmark", {
      headers: { authorization: `Bearer ${participantToken}` },
    }),
  );
  const payload = await response.json();

  assert.equal(requestedPeriod, "2026-W31");
  assert.equal(payload.landmarkLevel, 2);
  assert.equal(payload.validReadings, 24);
  assert.equal(payload.weeklyPeriod, "2026-W31");
  assert.equal(payload.weeklyValidReadings, 7);
  assert.equal(payload.weeklyMissionTarget, 10);
  assert.equal(payload.weeklyRemainingToGoal, 3);
});

test("未達五人隱私門檻只回傳安全進度帶，不洩漏精確篇數", async () => {
  const repo = repository();
  const api = createClassroomApi({ repository: repo, privacyThreshold: 5 });
  const created = await api.create("teacher-session");
  const { classCode } = await created.json();
  const joined = await api.join(
    new Request("https://example.test/join", {
      method: "POST",
      body: JSON.stringify({ classCode, seatToken: "w".repeat(43) }),
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
  assert.equal(payload.landmarkProgressBand, "foundation");
  assert.equal(payload.weeklyProgressBand, "starting");
  for (const preciseField of [
    "anonymousParticipants",
    "validReadings",
    "weeklyAnonymousParticipants",
    "weeklyValidReadings",
    "landmarkLevel",
    "nextLevelAt",
    "remainingToNextLevel",
    "weeklyRemainingToGoal",
  ]) {
    assert.equal(preciseField in payload, false, `${preciseField} 不得洩漏`);
  }
  assert.equal("categoryDistribution" in payload, false);
  assert.equal("individuals" in payload, false);
  assert.equal(payload.voteDistribution, null);
  assert.equal(payload.exitDistribution, null);
  assert.equal(payload.qualityRates, null);
});
