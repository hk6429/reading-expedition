import assert from "node:assert/strict";
import test from "node:test";

import { createClassroomApi } from "../../worker/src/api/classroom.js";
import { createApi } from "../../worker/src/api/router.js";
import { hashClassCredential } from "../../worker/src/auth/class-code.js";

test("教師以 UI 三選一設定任務，目標與週次由伺服器決定", async () => {
  let saved = null;
  const repository = {
    async setClassMission(record) {
      saved = record;
      return true;
    },
  };
  const clock = () => new Date("2026-08-22T10:00:00.000Z");
  const api = createClassroomApi({ repository, clock });

  const response = await api.setMission(
    "class-001",
    new Request("https://example.test/mission", {
      method: "POST",
      body: JSON.stringify({
        type: "category_balance",
      }),
    }),
    "teacher-session-001",
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.mission, {
    type: "category_balance",
    target: 3,
  });
  assert.equal(saved.classroomId, "class-001");
  assert.equal(saved.period, "2026-W34");
  assert.equal(saved.type, "category_balance");
  assert.equal(saved.target, 3);
  assert.equal(saved.createdBySession, "teacher-session-001");
  assert.equal(saved.updatedAt, "2026-08-22T10:00:00.000Z");
});

test("共同任務只額外接受 target 0 休息週，拒絕自訂目標與欄位", async () => {
  const repository = { setClassMission: async () => true };
  const api = createClassroomApi({ repository });
  const request = (body) =>
    new Request("https://example.test/mission", {
      method: "POST",
      body: JSON.stringify(body),
    });

  const rest = await api.setMission(
    "class-001",
    request({ type: "shared_readings", target: 0 }),
    "teacher-session-001",
  );
  const customTarget = await api.setMission(
    "class-001",
    request({ type: "shared_readings", target: 7 }),
    "teacher-session-001",
  );
  const extraField = await api.setMission(
    "class-001",
    request({ type: "category_balance", category: "science" }),
    "teacher-session-001",
  );

  assert.equal((await rest.json()).mission.target, 0);
  assert.equal(customTarget.status, 400);
  assert.equal(extraField.status, 400);
});

test("學生每週以匿名權杖投一次結構化任務票", async () => {
  const participantToken = "a".repeat(43);
  const tokenHash = await hashClassCredential(participantToken);
  let saved = null;
  const repository = {
    findClassroomToken: async (hash) =>
      hash === tokenHash
        ? {
            id: "participant-001",
            classroomId: "class-001",
            expiresAt: "2026-12-01T00:00:00.000Z",
            revokedAt: null,
          }
        : null,
    async addClassMissionVote(record) {
      saved = record;
      return true;
    },
  };
  const api = createClassroomApi({
    repository,
    clock: () => new Date("2026-08-22T10:00:00.000Z"),
  });

  const response = await api.vote(
    new Request("https://example.test/api/v1/classrooms/vote", {
      method: "POST",
      headers: { authorization: `Bearer ${participantToken}` },
      body: JSON.stringify({ choice: "category_balance" }),
    }),
  );

  assert.equal(response.status, 202);
  assert.deepEqual(saved, {
    classroomId: "class-001",
    participantId: "participant-001",
    period: "2026-W34",
    choice: "category_balance",
    createdAt: "2026-08-22T10:00:00.000Z",
  });
});

test("重複任務票回 409，非三選一或多餘欄位回 400", async () => {
  const participantToken = "d".repeat(43);
  const tokenHash = await hashClassCredential(participantToken);
  const repository = {
    findClassroomToken: async (hash) =>
      hash === tokenHash
        ? {
            id: "participant-004",
            classroomId: "class-001",
            expiresAt: "2026-12-01T00:00:00.000Z",
            revokedAt: null,
          }
        : null,
    addClassMissionVote: async () => false,
  };
  const api = createClassroomApi({ repository });
  const request = (body) =>
    new Request("https://example.test/vote", {
      method: "POST",
      headers: { authorization: `Bearer ${participantToken}` },
      body: JSON.stringify(body),
    });

  const duplicate = await api.vote(
    request({ choice: "ability_practice" }),
  );
  const freeText = await api.vote(request({ choice: "我想自由選" }));
  const extra = await api.vote(
    request({ choice: "shared_readings", name: "學生" }),
  );

  assert.equal(duplicate.status, 409);
  assert.equal(freeText.status, 400);
  assert.equal(extra.status, 400);
});

test("學生 vote 路由只轉交結構化投票 API", async () => {
  let received = null;
  const repository = { getPublishedDaily: async () => [] };
  const api = createApi({
    repository,
    classroomApi: {
      async vote(request) {
        received = await request.json();
        return new Response(null, { status: 202 });
      },
    },
  });

  const response = await api.fetch(
    new Request("https://example.test/api/v1/classrooms/vote", {
      method: "POST",
      body: JSON.stringify({ choice: "shared_readings" }),
    }),
  );

  assert.equal(response.status, 202);
  assert.deepEqual(received, { choice: "shared_readings" });
});

test("學生以匿名權杖更新本週結束單，不累加個人紀錄", async () => {
  const participantToken = "b".repeat(43);
  const tokenHash = await hashClassCredential(participantToken);
  let saved = null;
  const repository = {
    findClassroomToken: async (hash) =>
      hash === tokenHash
        ? {
            id: "participant-002",
            classroomId: "class-001",
            expiresAt: "2026-12-01T00:00:00.000Z",
            revokedAt: null,
          }
        : null,
    async upsertClassMissionExit(record) {
      saved = record;
      return true;
    },
  };
  const api = createClassroomApi({
    repository,
    clock: () => new Date("2026-08-22T10:00:00.000Z"),
  });

  const response = await api.exit(
    new Request("https://example.test/api/v1/classrooms/exit", {
      method: "POST",
      headers: { authorization: `Bearer ${participantToken}` },
      body: JSON.stringify({ code: "changed_view" }),
    }),
  );

  assert.equal(response.status, 202);
  assert.deepEqual(saved, {
    classroomId: "class-001",
    participantId: "participant-002",
    period: "2026-W34",
    code: "changed_view",
    updatedAt: "2026-08-22T10:00:00.000Z",
  });
});

test("結束單拒絕非白名單代碼與自由文字", async () => {
  const participantToken = "e".repeat(43);
  const tokenHash = await hashClassCredential(participantToken);
  const repository = {
    findClassroomToken: async (hash) =>
      hash === tokenHash
        ? {
            id: "participant-005",
            classroomId: "class-001",
            expiresAt: "2026-12-01T00:00:00.000Z",
            revokedAt: null,
          }
        : null,
    upsertClassMissionExit: async () => true,
  };
  const api = createClassroomApi({ repository });
  const response = await api.exit(
    new Request("https://example.test/exit", {
      method: "POST",
      headers: { authorization: `Bearer ${participantToken}` },
      body: JSON.stringify({ code: "found_evidence", reflection: "心得" }),
    }),
  );

  assert.equal(response.status, 400);
});

test("學生 exit 路由只轉交結構化結束單 API", async () => {
  let received = null;
  const repository = { getPublishedDaily: async () => [] };
  const api = createApi({
    repository,
    classroomApi: {
      async exit(request) {
        received = await request.json();
        return new Response(null, { status: 202 });
      },
    },
  });

  const response = await api.fetch(
    new Request("https://example.test/api/v1/classrooms/exit", {
      method: "POST",
      body: JSON.stringify({ code: "found_evidence" }),
    }),
  );

  assert.equal(response.status, 202);
  assert.deepEqual(received, { code: "found_evidence" });
});

test("landmark 達隱私門檻後回傳任務、指定閱讀與粗粒度群體分布", async () => {
  const participantToken = "c".repeat(43);
  const tokenHash = await hashClassCredential(participantToken);
  const repository = {
    findClassroomToken: async (hash) =>
      hash === tokenHash
        ? {
            id: "participant-003",
            classroomId: "class-001",
            expiresAt: "2026-12-01T00:00:00.000Z",
            revokedAt: null,
          }
        : null,
    getClassAggregate: async () => ({
      anonymousParticipants: 6,
      validReadings: 24,
      weeklyAnonymousParticipants: 6,
      weeklyValidReadings: 6,
      categoryDistribution: { world: 2, science: 3, humanities: 1 },
      skillDistribution: { comprehension: 2, inference: 2, evidence: 2 },
    }),
    getClassMissionContext: async () => ({
      mission: { type: "ability_practice", target: 10 },
      voteParticipants: 6,
      voteCounts: { shared_readings: 2, ability_practice: 4 },
      exitParticipants: 6,
      exitCounts: { found_evidence: 5, need_support: 1 },
      currentAssignment: {
        readingId: "water-guided-v1",
        title: "城市如何分配水源",
        ability: "evidence",
        route: "guided",
        dueDate: "2026-08-30",
      },
      quality: {
        count: 6,
        firstCorrect: 12,
        revisedCorrect: 3,
        evidenceViewed: 5,
        transferCompleted: 4,
      },
    }),
  };
  const api = createClassroomApi({
    repository,
    clock: () => new Date("2026-08-22T10:00:00.000Z"),
    privacyThreshold: 5,
  });

  const response = await api.landmark(
    new Request("https://example.test/api/v1/classrooms/landmark", {
      headers: { authorization: `Bearer ${participantToken}` },
    }),
  );
  const payload = await response.json();

  assert.deepEqual(payload.mission, {
    type: "ability_practice",
    target: 3,
  });
  assert.equal(payload.weeklyMissionTarget, 3);
  assert.equal(payload.missionProgress, 0);
  assert.equal(payload.missionRemaining, 3);
  assert.deepEqual(payload.voteDistribution, {
    shared_readings: 2,
    category_balance: 0,
    ability_practice: 4,
  });
  assert.deepEqual(payload.exitDistribution, {
    found_evidence: 5,
    changed_view: 0,
    need_support: 1,
  });
  assert.deepEqual(payload.qualityRates, {
    firstCorrectRate: 0.67,
    revisedCorrectRate: 0.5,
    evidenceViewedRate: 0.83,
    transferCompletedRate: 0.67,
  });
  assert.equal(payload.currentAssignment.readingId, "water-guided-v1");
});

test("教師班級清單附上當週任務、進度與受門檻保護的彙總", async () => {
  const repository = {
    listClassrooms: async () => [
      {
        id: "class-001",
        createdAt: "2026-08-01T00:00:00.000Z",
        expiresAt: "2027-01-01T00:00:00.000Z",
        revokedAt: null,
        anonymousParticipants: 6,
        validReadings: 24,
      },
    ],
    getClassAggregate: async () => ({
      anonymousParticipants: 6,
      validReadings: 24,
      weeklyAnonymousParticipants: 6,
      weeklyValidReadings: 7,
      categoryDistribution: { world: 3, science: 2, humanities: 2 },
      skillDistribution: { comprehension: 2, inference: 2, evidence: 3 },
    }),
    getClassMissionContext: async () => ({
      mission: { type: "category_balance", target: 10 },
      voteParticipants: 6,
      voteCounts: { category_balance: 6 },
      exitParticipants: 0,
      exitCounts: {},
      currentAssignment: null,
      quality: {
        count: 6,
        firstCorrect: 9,
        revisedCorrect: 3,
        evidenceViewed: 6,
        transferCompleted: 3,
      },
    }),
  };
  const api = createClassroomApi({
    repository,
    clock: () => new Date("2026-08-22T10:00:00.000Z"),
    privacyThreshold: 5,
  });

  const response = await api.list();
  const listPayload = await response.json();
  const classroom = listPayload.classrooms[0];

  assert.equal(classroom.weeklyPeriod, "2026-W34");
  assert.deepEqual(classroom.mission, {
    type: "category_balance",
    target: 3,
  });
  assert.equal(classroom.weeklyValidReadings, 7);
  assert.equal(classroom.missionProgress, 3);
  assert.equal(classroom.privacyProtected, false);
  assert.equal(classroom.voteDistribution.category_balance, 6);
  assert.equal(classroom.exitDistribution, null);
  assert.equal(classroom.qualityRates.evidenceViewedRate, 1);
  assert.deepEqual(
    [...new Set(listPayload.assignmentReadings.map(({ level }) => level))].sort(),
    ["launch", "tower", "voyage"],
  );
});

test("教師清單未達五人門檻時投票、觀點牆與品質率皆為 null", async () => {
  const repository = {
    listClassrooms: async () => [
      {
        id: "class-001",
        anonymousParticipants: 3,
        validReadings: 3,
      },
    ],
    getClassAggregate: async () => ({
      anonymousParticipants: 3,
      validReadings: 3,
      weeklyAnonymousParticipants: 3,
      weeklyValidReadings: 3,
      categoryDistribution: { science: 3 },
      skillDistribution: { evidence: 3 },
    }),
    getClassMissionContext: async () => ({
      mission: { type: "shared_readings", target: 10 },
      voteParticipants: 3,
      voteCounts: { shared_readings: 3 },
      exitParticipants: 3,
      exitCounts: { found_evidence: 3 },
      currentAssignment: null,
      quality: {
        count: 3,
        firstCorrect: 9,
        revisedCorrect: 0,
        evidenceViewed: 3,
        transferCompleted: 3,
      },
    }),
  };
  const api = createClassroomApi({ repository, privacyThreshold: 5 });

  const classroom = (await (await api.list()).json()).classrooms[0];

  assert.equal(classroom.privacyProtected, true);
  assert.equal(classroom.weeklyValidReadings, null);
  assert.equal(classroom.categoryDistribution, null);
  assert.equal(classroom.skillDistribution, null);
  assert.equal(classroom.voteDistribution, null);
  assert.equal(classroom.exitDistribution, null);
  assert.equal(classroom.qualityRates, null);
});

test("教師設定嚴格結構化指定閱讀且期限不影響任務進度", async () => {
  let saved = null;
  const repository = {
    async setClassAssignment(record) {
      saved = record;
      return true;
    },
  };
  const clock = () => new Date("2026-08-22T10:00:00.000Z");
  const api = createClassroomApi({ repository, clock });

  const response = await api.setAssignment(
    "class-001",
    new Request("https://example.test/assignment", {
      method: "POST",
      body: JSON.stringify({
        readingId: "water-guided-v1",
        title: "城市如何分配水源",
        ability: "evidence",
        route: "equivalent",
        dueDate: "2026-08-30",
      }),
    }),
    "teacher-session-001",
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.currentAssignment, {
    readingId: "water-guided-v1",
    title: "城市如何分配水源",
    ability: "evidence",
    route: "equivalent",
    dueDate: "2026-08-30",
  });
  assert.equal(saved.classroomId, "class-001");
  assert.equal(saved.createdBySession, "teacher-session-001");
  assert.equal(saved.updatedAt, "2026-08-22T10:00:00.000Z");
  assert.equal("target" in saved, false);
});

test("資料庫尚未補齊時，內建三階已校閱讀卷仍可被教師指派", async () => {
  let saved = null;
  const api = createClassroomApi({
    repository: {
      getPublishedReading: async () => null,
      setClassAssignment: async (record) => {
        saved = record;
        return true;
      },
    },
  });
  const response = await api.setAssignment(
    "class-001",
    new Request("https://example.test/assignment", {
      method: "POST",
      body: JSON.stringify({
        readingId: "old-photo-launch-v1",
        title: "客戶端不可竄改標題",
        ability: "evidence",
        route: "guided",
        dueDate: null,
      }),
    }),
    "teacher-session",
  );
  assert.equal(response.status, 200);
  assert.equal(saved.title, "舊照片沒有說完的故事");
});

test("指定閱讀拒絕錯誤路徑、無效日期與多餘欄位", async () => {
  const repository = { setClassAssignment: async () => true };
  const api = createClassroomApi({ repository });
  const request = (changes) =>
    new Request("https://example.test/assignment", {
      method: "POST",
      body: JSON.stringify({
        readingId: "water-guided-v1",
        title: "城市如何分配水源",
        ability: "evidence",
        route: "guided",
        dueDate: null,
        ...changes,
      }),
    });

  const badRoute = await api.setAssignment(
    "class-001",
    request({ route: "both" }),
    "teacher-session-001",
  );
  const badDate = await api.setAssignment(
    "class-001",
    request({ dueDate: "2026-02-30" }),
    "teacher-session-001",
  );
  const extra = await api.setAssignment(
    "class-001",
    request({ note: "自由文字" }),
    "teacher-session-001",
  );

  assert.equal(badRoute.status, 400);
  assert.equal(badDate.status, 400);
  assert.equal(extra.status, 400);
});

test("教師 mission 路由通過 session 與 CSRF 授權後設定指定班級", async () => {
  let saved = null;
  const repository = {
    getPublishedDaily: async () => [],
    async setClassMission(record) {
      saved = record;
      return true;
    },
  };
  const classroomApi = createClassroomApi({
    repository,
    clock: () => new Date("2026-08-22T10:00:00.000Z"),
  });
  const api = createApi({
    repository,
    classroomApi,
    teacherSessionApi: {
      authorize: async (_request, options) => {
        assert.equal(options.requireCsrf, true);
        return { ok: true, sessionId: "teacher-session-001" };
      },
      unauthorizedResponse: () => new Response(null, { status: 401 }),
    },
  });

  const response = await api.fetch(
    new Request(
      "https://example.test/api/v1/teacher/classrooms/class-001/mission",
      {
        method: "POST",
        body: JSON.stringify({ type: "ability_practice" }),
      },
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(saved.classroomId, "class-001");
  assert.equal(saved.type, "ability_practice");
  assert.equal(saved.createdBySession, "teacher-session-001");
});

test("教師 assignment 路由通過 session 與 CSRF 授權後設定指定閱讀", async () => {
  let saved = null;
  const repository = {
    getPublishedDaily: async () => [],
    async setClassAssignment(record) {
      saved = record;
      return true;
    },
  };
  const classroomApi = createClassroomApi({
    repository,
    clock: () => new Date("2026-08-22T10:00:00.000Z"),
  });
  const api = createApi({
    repository,
    classroomApi,
    teacherSessionApi: {
      authorize: async (_request, { requireCsrf }) => ({
        ok: requireCsrf,
        sessionId: "teacher-session-001",
      }),
      unauthorizedResponse: () => new Response(null, { status: 401 }),
    },
  });

  const response = await api.fetch(
    new Request(
      "https://example.test/api/v1/teacher/classrooms/class-001/assignment",
      {
        method: "POST",
        body: JSON.stringify({
          readingId: "water-guided-v1",
          title: "城市如何分配水源",
          ability: "evidence",
          route: "guided",
          dueDate: null,
        }),
      },
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(saved.readingId, "water-guided-v1");
  assert.equal(saved.createdBySession, "teacher-session-001");
});
