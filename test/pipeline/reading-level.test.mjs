import assert from "node:assert/strict";
import test from "node:test";

import {
  compareDifficultyLevels,
} from "../../worker/src/pipeline/reading-level.js";

function reading(text, glossary = []) {
  return { body: [{ id: "p1", text }], glossary };
}

test("登樓卷必須在篇幅、句子負荷或詞彙負荷至少一項明顯高於行舟卷", () => {
  const guided = reading("甲乙丙丁。".repeat(60));
  const easierChallenge = reading("甲乙。".repeat(100));
  const longerChallenge = reading("甲乙丙丁。".repeat(72));
  const denserChallenge = reading("甲乙丙丁戊己庚辛。".repeat(32));

  assert.equal(compareDifficultyLevels(guided, easierChallenge).ok, false);
  assert.equal(compareDifficultyLevels(guided, longerChallenge).ok, true);
  assert.equal(compareDifficultyLevels(guided, denserChallenge).ok, true);
});
