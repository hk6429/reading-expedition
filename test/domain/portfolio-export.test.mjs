import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPortfolioExport,
  unwrapPortfolioExport,
} from "../../src/domain/portfolio-export.js";

test("作品集匯出包含可讀資料字典、能力證據與隱私說明", () => {
  const learningState = {
    readingHistory: [{ readingId: "r1", evidence: "原文一句" }],
    diagnosticHistory: [{ readingId: "r1", items: [] }],
    completedReadings: { r1: { assessmentPassed: true } },
    abilityMastery: { skills: { evidence: { successes: ["r1"] } } },
    city: { investments: [] },
    preferences: { mode: "paper" },
  };
  const portfolio = buildPortfolioExport(learningState, {
    exportedAt: "2026-08-22T12:00:00.000Z",
  });
  assert.equal(portfolio.kind, "reading-expedition-portfolio");
  assert.equal(portfolio.privacy.serverUploadRequired, false);
  assert.match(portfolio.privacy.summary, /本機/);
  assert.match(portfolio.dataDictionary.readingHistory, /文證/);
  assert.match(portfolio.dataDictionary.abilityMastery, /能力證據/);
  assert.deepEqual(portfolio.learningState, learningState);
  assert.deepEqual(unwrapPortfolioExport(portfolio), learningState);
  assert.deepEqual(unwrapPortfolioExport(learningState), learningState);
});
