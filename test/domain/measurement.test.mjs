import assert from "node:assert/strict";
import test from "node:test";

import {
  computeLearningMetrics,
  evaluateExperiment,
} from "../../src/domain/measurement.js";

const event = (type, deviceId, day, contentId = "c-1", durationBucket = "6-10m") => ({
  type,
  occurredAt: `2026-07-${String(day).padStart(2, "0")}T08:00:00.000Z`,
  context: {
    contentId,
    category: "science",
    difficulty: "guided",
    durationBucket,
    deviceId,
  },
});

test("可計算有效閱讀、D1、D7、D30、文證一致率與回航率", () => {
  const events = [
    event("reading_completed", "device-a", 1),
    event("evidence_located", "device-a", 1),
    event("assessment_submitted", "device-a", 1),
    event("return_visit", "device-a", 2),
    event("return_visit", "device-a", 8),
    event("return_visit", "device-a", 31),
    event("reading_completed", "device-b", 1),
  ];
  const metrics = computeLearningMetrics(events);
  assert.equal(metrics.validReadings, 1);
  assert.equal(metrics.d1Retention, 0.5);
  assert.equal(metrics.d7Retention, 0.5);
  assert.equal(metrics.d30Retention, 0.5);
  assert.equal(metrics.evidenceConsistency, 1);
  assert.equal(metrics.returnRate, 0.5);
});

test("完成率上升但文證下降時不得判版本成功", () => {
  const verdict = evaluateExperiment(
    { completionRate: 0.72, evidenceConsistency: 0.84 },
    { completionRate: 0.81, evidenceConsistency: 0.76 },
    { fastSubmitRate: 0.08, fixedOptionRate: 0.19 },
  );
  assert.equal(verdict.success, false);
  assert.ok(verdict.reasons.includes("evidence_regressed"));
});
