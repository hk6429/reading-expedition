import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSESSMENT_VARIANT_FRAMES,
  createAssessmentVariantSet,
  getAssessmentSessionSeed,
} from "../../src/domain/assessment-variants.js";

const assessment = [
  {
    id: "q1",
    type: "comprehension",
    prompt: "本文主要說明什麼？",
    options: ["甲", "乙", "丙", "丁"],
    correctAnswer: "甲",
    evidenceSpan: { paragraph: 2, start: 3, end: 15 },
  },
  {
    id: "q2",
    type: "inference",
    prompt: "根據文章可以推知什麼？",
    options: ["甲", "乙", "丙", "丁"],
  },
  {
    id: "q3",
    type: "evidence",
    prompt: "哪個說法最有文證支持？",
    options: ["甲", "乙", "丙", "丁"],
  },
];

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test("理解、推論與文證各有至少兩個白名單等價任務框架", () => {
  assert.deepEqual(Object.keys(ASSESSMENT_VARIANT_FRAMES).sort(), [
    "comprehension",
    "evidence",
    "inference",
  ]);
  for (const frames of Object.values(ASSESSMENT_VARIANT_FRAMES)) {
    assert.ok(frames.length >= 2);
    assert.ok(frames.every(({ id, label, prefix }) => id && label && prefix));
  }
});

test("同一 session seed 穩定選題，新 seed 可換任務框架", () => {
  const first = createAssessmentVariantSet(assessment, { seed: "session-0" });
  const repeated = createAssessmentVariantSet(assessment, {
    seed: "session-0",
  });
  const nextSession = createAssessmentVariantSet(assessment, {
    seed: "session-1",
  });

  assert.deepEqual(repeated, first);
  assert.ok(
    first.some((item, index) => item.variantId !== nextSession[index].variantId),
  );
});

test("變體只包裝題面，原題識別、選項與評分語義保持不變", () => {
  const variants = createAssessmentVariantSet(assessment, {
    seed: "session-0",
  });

  variants.forEach((variant, index) => {
    assert.equal(variant.id, assessment[index].id);
    assert.equal(variant.type, assessment[index].type);
    assert.equal(variant.originalPrompt, assessment[index].prompt);
    assert.deepEqual(variant.options, assessment[index].options);
    assert.equal(variant.correctAnswer, assessment[index].correctAnswer);
    assert.deepEqual(variant.evidenceSpan, assessment[index].evidenceSpan);
    assert.notEqual(variant.prompt, assessment[index].prompt);
    assert.match(variant.prompt, new RegExp(assessment[index].prompt));
  });
});

test("分頁種子只存 sessionStorage，重用同值並拒絕污染字串", () => {
  const storage = memoryStorage();
  const first = getAssessmentSessionSeed(storage, {
    createSeed: () => "safe-session-seed-1",
  });
  const repeated = getAssessmentSessionSeed(storage, {
    createSeed: () => "unused-seed",
  });
  assert.equal(first, "safe-session-seed-1");
  assert.equal(repeated, first);

  const invalid = memoryStorage();
  invalid.setItem("reading-expedition:assessment-seed", "<script>alert(1)</script>");
  assert.equal(
    getAssessmentSessionSeed(invalid, {
      createSeed: () => "replacement-seed-2",
    }),
    "replacement-seed-2",
  );
});

test("未知能力或不完整題目無法偽裝成等價題", () => {
  assert.throws(
    () =>
      createAssessmentVariantSet(
        [{ ...assessment[0], type: "speed" }],
        { seed: "session-0" },
      ),
    /ability type/,
  );
  assert.throws(
    () =>
      createAssessmentVariantSet(
        [{ ...assessment[0], options: ["甲", "乙"] }],
        { seed: "session-0" },
      ),
    /four options/,
  );
});
