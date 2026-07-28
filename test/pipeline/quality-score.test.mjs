import assert from "node:assert/strict";
import test from "node:test";

import {
  QUALITY_WEIGHTS,
  calculateQualityScore,
} from "../../worker/src/pipeline/quality-score.js";

test("品質權重精確為來源20、事實25、原創15、難度15、題目20、安全5", () => {
  assert.deepEqual(QUALITY_WEIGHTS, {
    sources: 20,
    facts: 25,
    originality: 15,
    readingLevel: 15,
    assessment: 20,
    safety: 5,
  });
  assert.equal(
    calculateQualityScore({
      sources: 1,
      facts: 1,
      originality: 1,
      readingLevel: 1,
      assessment: 1,
      safety: 1,
    }).total,
    100,
  );
});

test("低於 92 分永遠送人工審核", () => {
  const result = calculateQualityScore({
      sources: 1,
      facts: 1,
      originality: 0.8,
      readingLevel: 0.8,
      assessment: 0.9,
    safety: 1,
  });

  assert.equal(result.total, 92);
  assert.equal(result.requiresManualReview, false);
  assert.equal(
    calculateQualityScore({
      sources: 1,
      facts: 1,
      originality: 0.75,
      readingLevel: 0.8,
      assessment: 0.9,
      safety: 1,
    }).requiresManualReview,
    true,
  );
});
