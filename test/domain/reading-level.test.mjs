import assert from "node:assert/strict";
import test from "node:test";

import {
  LEVEL_ORDER,
  normalizeReadingLevel,
  recommendLevelFromPlacement,
  recommendNextLevel,
} from "../../src/domain/reading-level.js";

test("三段閱讀程度順序固定為啟航、行舟、登樓", () => {
  assert.deepEqual(LEVEL_ORDER, ["launch", "voyage", "tower"]);
  assert.equal(normalizeReadingLevel("unknown"), "launch");
  assert.equal(normalizeReadingLevel("tower"), "tower");
});

test("完整短文三題測讀只提供推薦，不鎖住其他程度", () => {
  assert.deepEqual(recommendLevelFromPlacement(0), {
    recommendedLevel: "launch",
    unlockedLevels: LEVEL_ORDER,
  });
  assert.equal(recommendLevelFromPlacement(2).recommendedLevel, "voyage");
  assert.equal(recommendLevelFromPlacement(3).recommendedLevel, "tower");
});

test("每完成五篇只提示試試下一級，不自動改變目前程度", () => {
  assert.deepEqual(recommendNextLevel({
    currentLevel: "launch",
    completedCount: 5,
    lastPromptCount: 0,
  }), {
    currentLevel: "launch",
    suggestedLevel: "voyage",
    promptAt: 5,
  });
  assert.equal(recommendNextLevel({
    currentLevel: "voyage",
    completedCount: 6,
    lastPromptCount: 5,
  }), null);
  assert.equal(recommendNextLevel({
    currentLevel: "tower",
    completedCount: 10,
    lastPromptCount: 5,
  }), null);
});
