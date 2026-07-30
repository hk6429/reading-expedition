import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChildReport,
  buildDiagnosticRecord,
  reportRowsToCsv,
} from "../../src/domain/family-report.js";

const reading = {
  id: "water-01",
  title: "一杯水背後的共同承諾",
  category: "world",
  level: "launch",
  assessment: [
    { id: "q1", type: "comprehension" },
    { id: "q2", type: "inference" },
    { id: "q3", type: "evidence" },
  ],
};

test("診斷紀錄分開首次答對、修正成功與查看文證", () => {
  const record = buildDiagnosticRecord({
    reading,
    date: "2026-07-30",
    supportMode: "guided",
    firstResults: [
      { id: "q1", correct: true },
      { id: "q2", correct: false, diagnostic: "把例子當成原因" },
      { id: "q3", correct: false, diagnostic: "文證段落錯置" },
    ],
    finalResults: [
      { id: "q1", correct: true },
      { id: "q2", correct: true },
      { id: "q3", correct: false },
    ],
    evidenceViewedIds: ["q2", "q3"],
  });

  assert.equal(record.level, "launch");
  assert.equal(record.supportMode, "guided");
  assert.deepEqual(record.items[1], {
    type: "inference",
    firstCorrect: false,
    finalCorrect: true,
    revised: true,
    evidenceViewed: true,
    diagnostic: "把例子當成原因",
  });
});

test("家長報告先呈現週趨勢、卡關能力與下一步", () => {
  const report = buildChildReport({
    childId: "child-1",
    alias: "小舟",
    records: [
      {
        readingId: "r1",
        title: "文章一",
        date: "2026-07-29",
        level: "launch",
        supportMode: "guided",
        items: [
          { type: "comprehension", firstCorrect: true, finalCorrect: true },
          { type: "inference", firstCorrect: false, finalCorrect: true },
          { type: "evidence", firstCorrect: false, finalCorrect: false },
        ],
      },
    ],
  });

  assert.equal(report.completedCount, 1);
  assert.equal(report.stuckSkill, "evidence");
  assert.match(report.nextAction, /原文/);
  assert.equal(report.rows[0].childAlias, "小舟");
});

test("CSV 有 UTF-8 BOM，支援單一孩子與全家庭資料", () => {
  const csv = reportRowsToCsv([
    {
      childId: "child-1",
      childAlias: "小舟",
      date: "2026-07-30",
      title: "城市，水與選擇",
      level: "launch",
      supportMode: "guided",
      firstCorrect: 2,
      revisedCorrect: 1,
      stuckSkill: "evidence",
      evidenceViewed: true,
      nextAction: "回到原文找直接證據",
    },
    {
      childId: "child-2",
      childAlias: "小樓",
      date: "2026-07-30",
      title: "文章二",
      level: "tower",
      supportMode: "independent",
      firstCorrect: 3,
      revisedCorrect: 0,
      stuckSkill: "",
      evidenceViewed: false,
      nextAction: "可以試試下一級",
    },
  ]);

  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /child_id,child_alias,date,title/);
  assert.match(csv, /"城市，水與選擇"/);
  assert.match(csv, /child-2/);
});

test("CSV 會中和試算表公式開頭，避免孩子代號或標題被執行", () => {
  const csv = reportRowsToCsv([
    {
      childId: "child-1",
      childAlias: '=HYPERLINK("https://evil.test","點我")',
      date: "2026-07-30",
      title: "+SUM(1,1)",
      level: "launch",
      supportMode: "guided",
      firstCorrect: 1,
      revisedCorrect: 0,
      stuckSkill: "-1+1",
      evidenceViewed: false,
      nextAction: "@IMPORTDATA(test)",
    },
  ]);

  assert.doesNotMatch(csv, /(?:^|,)"?=/m);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'\+SUM/);
  assert.match(csv, /'-1\+1/);
  assert.match(csv, /'@IMPORTDATA/);
});
