import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClassMission,
  buildClassAssignment,
  buildClassDeepLink,
  classMissionCelebrationKey,
  chooseAnonymousRole,
  interventionForDistribution,
  interventionForAbilityMetrics,
  normalizeMissionChoice,
  normalizeAssignmentReadings,
} from "../../src/domain/class-mission.js";

test("共同任務只接受預設代碼，隱私門檻未達時完全隱藏細分", () => {
  assert.equal(normalizeMissionChoice("category_balance"), "category_balance");
  assert.equal(normalizeMissionChoice("請幫我寫答案"), null);

  const mission = buildClassMission({
    mission: { type: "ability_practice", target: 12 },
    weeklyPeriod: "2026-W34",
    weeklyValidReadings: 4,
    privacyProtected: true,
    participantThreshold: 5,
    categoryDistribution: { science: 4 },
    skillDistribution: { evidence: 4 },
    voteDistribution: { shared_readings: 4 },
    exitDistribution: { found_evidence: 4 },
  });

  assert.equal(mission.type, "ability_practice");
  assert.equal(mission.period, "2026-W34");
  assert.equal(mission.validReadingDefinition, "完成閱讀、通過作答門檻，並帶回一段原文文證");
  assert.equal(mission.categoryDistribution, null);
  assert.equal(mission.skillDistribution, null);
  assert.equal(mission.voteDistribution, null);
  assert.equal(mission.exitDistribution, null);
});

test("通過隱私門檻後只接受投票與觀點牆的三個預設代碼", () => {
  const mission = buildClassMission({
    privacyProtected: false,
    voteDistribution: {
      shared_readings: 3,
      category_balance: 2,
      ability_practice: 1,
      free_text: 99,
    },
    exitDistribution: {
      found_evidence: 4,
      changed_view: 1,
      need_support: 2,
      student_name: 99,
    },
  });

  assert.deepEqual(mission.voteDistribution, {
    shared_readings: 3,
    category_balance: 2,
    ability_practice: 1,
  });
  assert.deepEqual(mission.exitDistribution, {
    found_evidence: 4,
    changed_view: 1,
    need_support: 2,
  });
});

test("學習品質只接受 0 到 1 的聚合率，未達隱私門檻完全隱藏", () => {
  const protectedMission = buildClassMission({
    privacyProtected: true,
    qualityRates: {
      firstCorrectRate: 0.7,
      revisedCorrectRate: 0.4,
      evidenceViewedRate: 0.8,
      transferCompletedRate: 0.5,
    },
  });
  assert.equal(protectedMission.qualityRates, null);

  const visible = buildClassMission({
    privacyProtected: false,
    qualityRates: {
      firstCorrectRate: 0.7,
      revisedCorrectRate: 0.4,
      evidenceViewedRate: 0.8,
      transferCompletedRate: 0.5,
    },
  });
  assert.deepEqual(visible.qualityRates, {
    firstCorrectRate: 0.7,
    revisedCorrectRate: 0.4,
    evidenceViewedRate: 0.8,
    transferCompletedRate: 0.5,
  });
  assert.equal(
    buildClassMission({
      privacyProtected: false,
      qualityRates: { firstCorrectRate: 2 },
    }).qualityRates,
    null,
  );
});

test("達標動畫鍵只由匿名權杖、週期與任務類型決定", () => {
  const key = classMissionCelebrationKey(
    "participant-token",
    "2026-W34",
    "category_balance",
  );
  assert.match(key, /^reading-expedition\.class-celebrated:v1:[a-f0-9]{8}$/);
  assert.equal(key.includes("participant-token"), false);
  assert.equal(
    key,
    classMissionCelebrationKey(
      "participant-token",
      "2026-W34",
      "category_balance",
    ),
  );
  assert.notEqual(
    key,
    classMissionCelebrationKey(
      "participant-token",
      "2026-W35",
      "category_balance",
    ),
  );
});

test("教師指派只接受文章清單中的結構資料與白名單選項", () => {
  const readings = normalizeAssignmentReadings([
    {
      id: "water-sharing-guided-v1",
      title: "一座城市如何分配水源？",
      body: ["正文不可進入指派 payload"],
    },
    { id: "bad id", title: "不安全" },
  ]);
  assert.deepEqual(readings, [
    {
      readingId: "water-sharing-guided-v1",
      title: "一座城市如何分配水源？",
    },
  ]);

  assert.deepEqual(
    buildClassAssignment(
      {
        readingId: "water-sharing-guided-v1",
        ability: "evidence",
        route: "equivalent",
        dueDate: "2026-09-01",
        freeText: "不可送出",
      },
      readings,
    ),
    {
      readingId: "water-sharing-guided-v1",
      title: "一座城市如何分配水源？",
      ability: "evidence",
      route: "equivalent",
      dueDate: "2026-09-01",
    },
  );
  assert.equal(
    buildClassAssignment(
      {
        readingId: "unknown",
        ability: "score",
        route: "fast",
        dueDate: "明天",
      },
      readings,
    ),
    null,
  );
});

test("教師指派可選無期限，期限只保留日期而不建立倒數狀態", () => {
  const readings = [
    { readingId: "reading-1", title: "測試文章" },
  ];
  assert.deepEqual(
    buildClassAssignment(
      {
        readingId: "reading-1",
        ability: "comprehension",
        route: "guided",
        dueDate: "",
      },
      readings,
    ),
    {
      readingId: "reading-1",
      title: "測試文章",
      ability: "comprehension",
      route: "guided",
      dueDate: null,
    },
  );
});

test("教師深連結只有班級碼，能力熱圖會導出最需要的十分鐘介入", () => {
  assert.equal(
    buildClassDeepLink(
      "https://reading.example/teacher?name=王老師#/teacher",
      "ABC23456",
    ),
    "https://reading.example/#/class?code=ABC23456",
  );
  assert.equal(buildClassDeepLink("https://reading.example/", "bad name"), null);

  assert.deepEqual(
    interventionForDistribution({
      comprehension: 8,
      inference: 2,
      evidence: 5,
    }),
    {
      skill: "inference",
      title: "10 分鐘線索連線",
      steps: "找兩個線索、畫出關係、說明推論依據。",
    },
  );
});

test("能力介入只比較達最低樣本的首次正確率，不把篇數少誤判為弱點", () => {
  const intervention = interventionForAbilityMetrics({
    comprehension: { opportunities: 8, firstCorrect: 6 },
    inference: { opportunities: 7, firstCorrect: 2 },
    evidence: { opportunities: 2, firstCorrect: 0 },
  });
  assert.equal(intervention.skill, "inference");
  assert.equal(intervention.opportunities, 7);
  assert.equal(intervention.firstCorrect, 2);
  assert.match(intervention.exitCheck, /Exit check/);

  const insufficient = interventionForAbilityMetrics({
    evidence: { opportunities: 4, firstCorrect: 0 },
  });
  assert.equal(insufficient.skill, null);
  assert.match(insufficient.title, /樣本/);
});

test("匿名合作角色只由權杖與期間決定，不產生個人公開資料", () => {
  const first = chooseAnonymousRole("participant-token", "2026-W34");
  const again = chooseAnonymousRole("participant-token", "2026-W34");
  const nextWeek = chooseAnonymousRole("participant-token", "2026-W35");

  assert.deepEqual(first, again);
  assert.match(first.code, /^(pathfinder|verifier|organizer)$/);
  assert.notEqual(first.code, nextWeek.code);
  assert.equal("name" in first, false);
});
