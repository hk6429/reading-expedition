import assert from "node:assert/strict";
import test from "node:test";

import { createReadingRepository } from "../../worker/src/db/repository.js";

function createFakeDb(rows) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async all() {
          return { results: rows };
        },
      };
    },
  };
}

test("repository 依日期取得已發布文章並解析結構欄位", async () => {
  const db = createFakeDb([
    {
      id: "water-001-guided",
      content_key: "2026-07-28-water",
      category: "world",
      topic_date: "2026-07-28",
      difficulty: "guided",
      reading_level: "launch",
      support_mode: "guided",
      text_type: "plain",
      title: "城市如何分配有限水源？",
      hook_question: "如果水不夠，每個人都該一樣多嗎？",
      glossary_json: '[{"term":"水權","definition":"使用水資源的權利"}]',
      source_attribution_json: '[{"publisher":"公開資料站"}]',
      version: 1,
    },
  ]);
  const repository = createReadingRepository(db);

  const readings = await repository.getPublishedDaily("2026-07-28");

  assert.equal(readings.length, 1);
  assert.deepEqual(readings[0].glossary, [
    { term: "水權", definition: "使用水資源的權利" },
  ]);
  assert.deepEqual(readings[0].sourceAttribution, [
    { publisher: "公開資料站" },
  ]);
  assert.equal(readings[0].level, "launch");
  assert.equal(readings[0].supportMode, "guided");
  assert.match(db.calls[0].sql, /publication_status = 'published'/);
  assert.deepEqual(db.calls[0].bindings, ["2026-07-28"]);
});

test("repository 可取得指定日期以前最近一次已發布文章，不設七日下限", async () => {
  const db = createFakeDb([
    {
      id: "water-001-guided",
      content_key: "2026-07-28-water",
      topic_date: "2026-07-28",
      category: "world",
      difficulty: "guided",
      text_type: "plain",
      title: "城市如何分配有限水源？",
      hook_question: "如果水不夠，每個人都該一樣多嗎？",
      reading_minutes: 6,
      glossary_json: "[]",
      source_attribution_json: "[]",
      version: 1,
    },
  ]);
  const repository = createReadingRepository(db);

  const readings = await repository.getLatestPublishedDaily("2026-07-29");

  assert.equal(readings[0].topicDate, "2026-07-28");
  assert.match(db.calls[0].sql, /MAX\(fp2\.topic_date\)/);
  assert.doesNotMatch(db.calls[0].sql, /-7 days/);
  assert.deepEqual(db.calls[0].bindings, ["2026-07-29"]);
});

test("repository 依 level 分頁取得全部已發布 metadata", async () => {
  const db = createFakeDb([
    {
      id: "launch-001-guided",
      content_key: "launch-001",
      topic_date: "2026-07-29",
      category: "world",
      difficulty: "guided",
      reading_level: "launch",
      support_mode: "guided",
      text_type: "vernacular",
      title: "第一卷",
      hook_question: "為什麼？",
      reading_minutes: 5,
      version: 1,
      total_count: 60,
    },
  ]);
  const repository = createReadingRepository(db);
  const result = await repository.listPublishedReadings({
    level: "launch",
    limit: 20,
    offset: 40,
  });

  assert.equal(result.total, 60);
  assert.equal(result.readings[0].id, "launch-001-guided");
  assert.match(db.calls[0].sql, /reading_level = \?/);
  assert.match(db.calls[0].sql, /COUNT\(\*\) OVER\(\)/);
  assert.deepEqual(db.calls[0].bindings, ["launch", 20, 40]);
});

test("repository 只取得已發布文章的正文與題目", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async first() {
          return {
            id: "water-001-guided",
            content_key: "2026-07-28-water",
            category: "world",
            difficulty: "guided",
            text_type: "plain",
            title: "城市如何分配有限水源？",
            hook_question: "分配一樣多，就是公平嗎？",
            body: '["第一段","第二段"]',
            glossary_json: "[]",
            reading_strategy_json:
              '{"name":"因果證據鏈閱讀法","purpose":"先找現象的原因，再核對文章提出的證據與結論。","steps":[],"structureMap":"先提出問題，再比較不同分配方式，最後形成判斷標準。","expertTip":"先分清楚文章明說的內容，以及讀者自行補入的推論。","selfCheck":"我的結論能否回到原文找到直接證據？"}',
            source_attribution_json: '[{"publisher":"公開資料站"}]',
            reading_minutes: 6,
            version: 1,
          };
        },
        async all() {
          return {
            results: [
              {
                id: "water-001-q1",
                item_type: "comprehension",
                prompt: "文章主要討論什麼？",
                options_json: '["城市用水","海洋生物"]',
                correct_answer: "城市用水",
                rationale: "全文聚焦城市水源。",
                distractor_reasons_json: '{"海洋生物":"文中未提及"}',
                evidence_span_json: '{"paragraph":1,"start":0,"end":3}',
              },
            ],
          };
        },
      };
    },
  };

  const repository = createReadingRepository(db);
  const reading = await repository.getPublishedReading("water-001-guided");

  assert.deepEqual(reading.body, ["第一段", "第二段"]);
  assert.equal(reading.hookQuestion, "分配一樣多，就是公平嗎？");
  assert.equal(reading.readingStrategy.name, "因果證據鏈閱讀法");
  assert.equal(reading.assessment[0].correctAnswer, "城市用水");
  assert.match(calls[0].sql, /publication_status = 'published'/);
  assert.deepEqual(calls[0].bindings, ["water-001-guided"]);
  assert.deepEqual(calls[1].bindings, ["water-001-guided"]);
});

test("文章發布升版後仍可使用各題最新版本作答", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async all() {
          return {
            results: [
              {
                id: "moon-phases-guided-comprehension-01",
                correct_answer: "觀察者看見的受光比例改變",
                rationale: "文章版本升版不代表題目必須同步升版。",
                distractor_reasons_json: "{}",
                evidence_span_json:
                  '{"paragraph":2,"start":0,"end":10}',
              },
            ],
          };
        },
      };
    },
  };
  const repository = createReadingRepository(db);

  const answerKey = await repository.getAssessmentKey(
    "moon-phases-guided",
    2,
  );

  assert.equal(answerKey.length, 1);
  assert.match(calls[0].sql, /MAX\(ai2\.version\)/);
  assert.deepEqual(calls[0].bindings, ["moon-phases-guided", 2]);
});

test("repository 提供完成證明所需的發布文章 canonical context", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async first() {
          return {
            reading_id: "water-sharing-guided-v1",
            content_key: "water-sharing",
            version: 1,
            category: "science",
          };
        },
      };
    },
  };
  const repository = createReadingRepository(db);

  const context = await repository.getAssessmentProofContext(
    "water-sharing-guided-v1",
    1,
  );

  assert.deepEqual(context, {
    readingId: "water-sharing-guided-v1",
    contentKey: "water-sharing",
    version: 1,
    category: "science",
  });
  assert.match(calls[0].sql, /publication_status = 'published'/);
  assert.deepEqual(calls[0].bindings, ["water-sharing-guided-v1", 1]);
});

test("repository 列出匿名班級統計並同步停用班級與權杖", async () => {
  const calls = [];
  const batches = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async all() {
          return {
            results: [
              {
                id: "class-001",
                created_at: "2026-07-28T00:00:00Z",
                expires_at: "2027-01-24T00:00:00Z",
                revoked_at: null,
                anonymous_participants: 6,
                valid_readings: 18,
              },
            ],
          };
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return [{ meta: { changes: 1 } }, { meta: { changes: 3 } }];
    },
  };
  const repository = createReadingRepository(db);

  const classrooms = await repository.listClassrooms();
  const revoked = await repository.revokeClassroom(
    "class-001",
    "2026-07-28T01:00:00Z",
  );

  assert.equal(classrooms[0].anonymousParticipants, 6);
  assert.equal(classrooms[0].validReadings, 18);
  assert.equal("classCode" in classrooms[0], false);
  assert.equal(revoked, true);
  assert.match(calls[0].sql, /LEFT JOIN classroom_contributions/);
  assert.match(calls[1].sql, /UPDATE classrooms/);
  assert.match(calls[2].sql, /UPDATE classroom_tokens/);
  assert.equal(batches[0].length, 2);
});

test("repository 分開彙總班級永久地標與指定週任務", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async first() {
          if (/period = \?/.test(sql)) {
            return { valid_readings: 7, anonymous_participants: 5 };
          }
          return { valid_readings: 24, anonymous_participants: 6 };
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };
  const repository = createReadingRepository(db);

  const aggregate = await repository.getClassAggregate(
    "class-001",
    "2026-W31",
  );

  assert.equal(aggregate.validReadings, 24);
  assert.equal(aggregate.weeklyValidReadings, 7);
  assert.equal(aggregate.weeklyAnonymousParticipants, 5);
  assert.deepEqual(calls[0].bindings, ["class-001"]);
  assert.match(calls[1].sql, /period = \?/);
  assert.deepEqual(calls[1].bindings, ["class-001", "2026-W31"]);
});

test("repository 只替有效班級 upsert 當週共同任務", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
    },
  };
  const repository = createReadingRepository(db);

  const saved = await repository.setClassMission({
    classroomId: "class-001",
    period: "2026-W34",
    type: "category_balance",
    target: 10,
    createdBySession: "teacher-session-001",
    updatedAt: "2026-08-22T10:00:00.000Z",
  });

  assert.equal(saved, true);
  assert.match(calls[0].sql, /INSERT INTO class_missions/);
  assert.match(calls[0].sql, /ON CONFLICT\(classroom_id, period\)/);
  assert.match(calls[0].sql, /revoked_at IS NULL/);
  assert.deepEqual(calls[0].bindings.slice(1), [
    "class-001",
    "2026-W34",
    "category_balance",
    10,
    "teacher-session-001",
    "2026-08-22T10:00:00.000Z",
    "2026-08-22T10:00:00.000Z",
    "class-001",
  ]);
});

test("repository 每個匿名權杖每週只接受一張任務票", async () => {
  const calls = [];
  let writes = 0;
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async run() {
          writes += 1;
          return { meta: { changes: writes === 1 ? 1 : 0 } };
        },
      };
    },
  };
  const repository = createReadingRepository(db);
  const vote = {
    classroomId: "class-001",
    participantId: "participant-001",
    period: "2026-W34",
    choice: "category_balance",
    createdAt: "2026-08-22T10:00:00.000Z",
  };

  assert.equal(await repository.addClassMissionVote(vote), true);
  assert.equal(await repository.addClassMissionVote(vote), false);
  assert.match(calls[0].sql, /INSERT OR IGNORE INTO class_mission_votes/);
  assert.deepEqual(calls[0].bindings.slice(1), [
    "class-001",
    "participant-001",
    "2026-W34",
    "category_balance",
    "2026-08-22T10:00:00.000Z",
  ]);
});

test("repository 將同一匿名權杖的本週結束單更新在同一列", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
    },
  };
  const repository = createReadingRepository(db);

  await repository.upsertClassMissionExit({
    classroomId: "class-001",
    participantId: "participant-001",
    period: "2026-W34",
    code: "need_support",
    updatedAt: "2026-08-22T10:00:00.000Z",
  });

  assert.match(calls[0].sql, /INSERT INTO class_mission_exits/);
  assert.match(
    calls[0].sql,
    /ON CONFLICT\(classroom_id, participant_id, period\)/,
  );
  assert.match(calls[0].sql, /exit_code = excluded\.exit_code/);
  assert.deepEqual(calls[0].bindings.slice(1), [
    "class-001",
    "participant-001",
    "2026-W34",
    "need_support",
    "2026-08-22T10:00:00.000Z",
  ]);
});

test("repository 只回傳當週共同任務的群體彙總與目前指定閱讀", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async first() {
          if (/FROM class_missions/.test(sql)) {
            return { mission_type: "ability_practice", target: 10 };
          }
          if (/FROM class_assignments/.test(sql)) {
            return {
              reading_id: "water-guided-v1",
              title: "城市如何分配水源",
              ability: "evidence",
              route: "guided",
              due_date: "2026-08-30",
            };
          }
          return {
            quality_count: 6,
            first_correct: 12,
            revised_correct: 3,
            evidence_viewed: 5,
            transfer_completed: 4,
          };
        },
        async all() {
          if (/FROM class_mission_votes/.test(sql)) {
            return {
              results: [
                { choice: "shared_readings", count: 2 },
                { choice: "ability_practice", count: 4 },
              ],
            };
          }
          return {
            results: [
              { exit_code: "found_evidence", count: 5 },
              { exit_code: "need_support", count: 1 },
            ],
          };
        },
      };
    },
  };
  const repository = createReadingRepository(db);

  const context = await repository.getClassMissionContext(
    "class-001",
    "2026-W34",
  );

  assert.deepEqual(context, {
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
  });
  assert.equal(calls.length, 5);
  assert.deepEqual(calls[0].bindings, ["class-001", "2026-W34"]);
  assert.deepEqual(calls[1].bindings, ["class-001", "2026-W34"]);
  assert.deepEqual(calls[2].bindings, ["class-001", "2026-W34"]);
  assert.deepEqual(calls[3].bindings, ["class-001"]);
  assert.deepEqual(calls[4].bindings, ["class-001", "2026-W34"]);
});

test("repository 只替有效班級 upsert 目前指定閱讀", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
    },
  };
  const repository = createReadingRepository(db);

  const saved = await repository.setClassAssignment({
    classroomId: "class-001",
    readingId: "water-guided-v1",
    title: "城市如何分配水源",
    ability: "evidence",
    route: "equivalent",
    dueDate: null,
    createdBySession: "teacher-session-001",
    updatedAt: "2026-08-22T10:00:00.000Z",
  });

  assert.equal(saved, true);
  assert.match(calls[0].sql, /INSERT INTO class_assignments/);
  assert.match(calls[0].sql, /ON CONFLICT\(classroom_id\)/);
  assert.match(calls[0].sql, /revoked_at IS NULL/);
  assert.deepEqual(calls[0].bindings.slice(1), [
    "class-001",
    "water-guided-v1",
    "城市如何分配水源",
    "evidence",
    "equivalent",
    null,
    "teacher-session-001",
    "2026-08-22T10:00:00.000Z",
    "2026-08-22T10:00:00.000Z",
    "class-001",
  ]);
});

test("repository 以 nonce 與 canonical content key 原子防重並回報是否計入", async () => {
  const calls = [];
  let runCount = 0;
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async run() {
          runCount += 1;
          return { meta: { changes: runCount === 1 ? 1 : 0 } };
        },
      };
    },
  };
  const repository = createReadingRepository(db);
  const record = {
    classroomId: "class-001",
    participantId: "participant-001",
    contentId: "water-guided-v1",
    canonicalContentKey: "water",
    readingVersion: 1,
    category: "science",
    skill: "evidence",
    proofNonce: "proof-nonce-001",
    period: "2026-W34",
    createdAt: "2026-08-22T10:00:00.000Z",
    quality: {
      firstCorrect: 2,
      revisedCorrect: 1,
      evidenceViewed: true,
      transferCompleted: false,
    },
  };

  assert.equal(await repository.addClassContribution(record), true);
  assert.equal(await repository.addClassContribution(record), false);
  assert.match(calls[0].sql, /INSERT OR IGNORE/);
  assert.match(calls[0].sql, /canonical_content_key/);
  assert.match(calls[0].sql, /proof_nonce/);
  assert.deepEqual(calls[0].bindings.slice(1), [
    "class-001",
    "participant-001",
    "water-guided-v1",
    "water",
    1,
    "science",
    "evidence",
    "proof-nonce-001",
    "2026-W34",
    "2026-08-22T10:00:00.000Z",
    2,
    1,
    1,
    0,
  ]);
});

test("repository 以匿名權杖及一分鐘視窗計算近期貢獻", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async first() {
          return { contribution_count: 7 };
        },
      };
    },
  };
  const repository = createReadingRepository(db);

  const count = await repository.countRecentClassContributions(
    "participant-001",
    "2026-08-22T09:59:00.000Z",
  );

  assert.equal(count, 7);
  assert.match(calls[0].sql, /julianday\(created_at\)/);
  assert.deepEqual(calls[0].bindings, [
    "participant-001",
    "2026-08-22T09:59:00.000Z",
  ]);
});

test("repository 以班級及一分鐘視窗計算群體近期貢獻", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async first() {
          return { contribution_count: 120 };
        },
      };
    },
  };
  const repository = createReadingRepository(db);

  const count = await repository.countRecentClassroomContributions(
    "class-001",
    "2026-08-22T09:59:00.000Z",
  );

  assert.equal(count, 120);
  assert.match(calls[0].sql, /classroom_id = \?/);
  assert.match(calls[0].sql, /julianday\(created_at\)/);
  assert.deepEqual(calls[0].bindings, [
    "class-001",
    "2026-08-22T09:59:00.000Z",
  ]);
});

test("repository 清除保存期限以前的匿名事件", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
        async run() {
          return { meta: { changes: 23 } };
        },
      };
    },
  };
  const repository = createReadingRepository(db);

  const deleted = await repository.purgeExpiredAnonymousEvents(
    "2026-07-08T00:00:00.000Z",
  );

  assert.equal(deleted, 23);
  assert.match(calls[0].sql, /DELETE FROM anonymous_events/);
  assert.match(calls[0].sql, /created_at < \?/);
  assert.deepEqual(calls[0].bindings, ["2026-07-08T00:00:00.000Z"]);
});

test("repository 刪除家庭時依序實體移除狀態、孩子、sessions 與護照", async () => {
  const calls = [];
  const batches = [];
  const db = {
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
  const repository = createReadingRepository(db);

  await repository.revokeFamily("family-1");

  assert.equal(batches[0].length, 4);
  assert.match(calls[0].sql, /DELETE FROM family_child_states/);
  assert.match(calls[1].sql, /DELETE FROM family_children/);
  assert.match(calls[2].sql, /DELETE FROM family_sessions/);
  assert.match(calls[3].sql, /DELETE FROM family_passports/);
  assert.deepEqual(
    calls.map(({ bindings }) => bindings),
    [
      ["family-1"],
      ["family-1"],
      ["family-1"],
      ["family-1"],
    ],
  );
});
