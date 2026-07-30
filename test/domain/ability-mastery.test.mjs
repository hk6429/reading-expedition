import assert from "node:assert/strict";
import test from "node:test";

import {
  createAbilityMastery,
  recordAbilityEvidence,
} from "../../src/domain/ability-mastery.js";

function results(readingId, correctTypes, revisedTypes = []) {
  const items = ["comprehension", "inference", "evidence"].map((type) => ({
    id: `${readingId}-${type}`,
    type,
    firstCorrect: correctTypes.includes(type),
    finalCorrect:
      correctTypes.includes(type) || revisedTypes.includes(type),
  }));
  return { readingId, date: "2026-07-30", items };
}

test("能力裝備只由首次答對累積，修正成功另計修正力", () => {
  const mastery = recordAbilityEvidence(
    createAbilityMastery(),
    results("r1", ["comprehension"], ["inference"]),
  );

  assert.equal(mastery.skills.comprehension.successes.length, 1);
  assert.equal(mastery.skills.inference.successes.length, 0);
  assert.equal(mastery.revisionStrength.length, 1);
  assert.deepEqual(mastery.unlockedEquipment, []);
});

test("同一能力跨至少兩篇、成功三次才解鎖對應裝備", () => {
  let mastery = createAbilityMastery();
  mastery = recordAbilityEvidence(
    mastery,
    results("r1", ["evidence"]),
  );
  mastery = recordAbilityEvidence(
    mastery,
    results("r2", ["evidence"]),
  );
  mastery = recordAbilityEvidence(
    mastery,
    results("r3", ["evidence"]),
  );

  assert.equal(mastery.skills.evidence.successes.length, 3);
  assert.deepEqual(mastery.unlockedEquipment, ["evidence-lens"]);
});

test("重做同一篇不能靠刷題解鎖裝備", () => {
  let mastery = createAbilityMastery();
  mastery = recordAbilityEvidence(
    mastery,
    results("r1", ["inference"]),
  );
  mastery = recordAbilityEvidence(
    mastery,
    results("r1", ["inference"]),
  );
  mastery = recordAbilityEvidence(
    mastery,
    results("r1", ["inference"]),
  );

  assert.equal(mastery.skills.inference.successes.length, 1);
  assert.deepEqual(mastery.unlockedEquipment, []);
});
