import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  decidePublication,
  evaluateHardGates,
} from "../../worker/src/pipeline/hard-gates.js";

const passing = {
  sourceTraceable: true,
  licenseClear: true,
  factPackVerified: true,
  twoDifficultiesShareFacts: true,
  similarity: 0.2,
  assessmentValid: true,
  readingLevelValid: true,
  contentProfileValid: true,
  schemaValid: true,
};

test("任一硬性閘門失敗都不得發布", () => {
  const result = evaluateHardGates({ ...passing, assessmentValid: false });

  assert.equal(result.passed, false);
  assert.ok(result.failed.includes("assessment_valid"));
  assert.equal(
    decidePublication({
      hardGates: result,
      qualityScore: 100,
      formalDay: 31,
      sensitivityFlags: [],
    }).status,
    "blocked",
  );
});

test("前30個正式日與敏感題材永遠人工審核", () => {
  const hardGates = evaluateHardGates(passing);

  assert.equal(
    decidePublication({
      hardGates,
      qualityScore: 100,
      formalDay: 30,
      sensitivityFlags: [],
    }).status,
    "manual_review",
  );
  assert.equal(
    decidePublication({
      hardGates,
      qualityScore: 100,
      formalDay: 31,
      sensitivityFlags: ["politics"],
    }).status,
    "manual_review",
  );
});

test("黃金資料集至少30組並可重跑硬門檻", () => {
  const golden = JSON.parse(
    fs.readFileSync(
      new URL("../fixtures/golden/quality-cases.json", import.meta.url),
      "utf8",
    ),
  );

  assert.ok(golden.length >= 30);
  for (const item of golden) {
    assert.equal(
      evaluateHardGates({
        contentProfileValid: true,
        readingLevelValid: true,
        ...item.input,
      }).passed,
      item.expectedPassed,
    );
  }
});

test("行舟卷未低於登樓卷時不得發布", () => {
  const result = evaluateHardGates({
    ...passing,
    readingLevelValid: false,
  });

  assert.equal(result.passed, false);
  assert.ok(result.failed.includes("reading_level_valid"));
});

test("篇幅、文體或文言注釋不合格時不得發布", () => {
  const result = evaluateHardGates({
    ...passing,
    contentProfileValid: false,
  });

  assert.equal(result.passed, false);
  assert.ok(result.failed.includes("content_profile_valid"));
});
