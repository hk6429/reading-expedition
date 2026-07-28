import assert from "node:assert/strict";
import test from "node:test";

import {
  investInBuilding,
  rewardVerifiedReading,
} from "../../src/domain/city.js";
import { createDefaultState } from "../../src/storage/local-store.js";

test("完成閱讀與文證必有基本墨磚，修正也能增加成果", () => {
  const independent = rewardVerifiedReading({
    completed: true,
    evidenceSubmitted: true,
    correctCount: 2,
    revisedCount: 0,
    repeatedSameDay: false,
  });
  const revised = rewardVerifiedReading({
    completed: true,
    evidenceSubmitted: true,
    correctCount: 1,
    revisedCount: 1,
    repeatedSameDay: false,
  });
  const needsSupport = rewardVerifiedReading({
    completed: true,
    evidenceSubmitted: true,
    correctCount: 0,
    revisedCount: 0,
    repeatedSameDay: false,
  });

  assert.equal(independent.inkBricks, 5);
  assert.equal(revised.inkBricks, 5);
  assert.equal(needsSupport.inkBricks, 5);
  assert.equal(revised.baseEarned, true);
});

test("同篇同日重刷沒有完整資源，速度不影響結果", () => {
  const first = rewardVerifiedReading({
    completed: true,
    evidenceSubmitted: true,
    correctCount: 2,
    revisedCount: 0,
    repeatedSameDay: false,
    elapsedSeconds: 60,
  });
  const slow = rewardVerifiedReading({
    completed: true,
    evidenceSubmitted: true,
    correctCount: 2,
    revisedCount: 0,
    repeatedSameDay: false,
    elapsedSeconds: 900,
  });
  const repeated = rewardVerifiedReading({
    completed: true,
    evidenceSubmitted: true,
    correctCount: 2,
    revisedCount: 0,
    repeatedSameDay: true,
  });

  assert.equal(first.inkBricks, slow.inkBricks);
  assert.equal(repeated.inkBricks, 0);
});

test("投入墨磚會記錄文章並讓建築最高成長至五階", () => {
  const state = createDefaultState("device-123");
  state.city.materials.inkBricks = 12;

  const result = investInBuilding(state, {
    buildingId: "library",
    readingId: "water-sharing-guided-v1",
    date: "2026-07-28",
    inkBricks: 5,
    knowledge: {
      title: "一座城市如何分配有限水源？",
      category: "world",
      evidence: "不同用途的基本需要與缺水影響可能不同",
      ability: "evidence",
    },
  });

  assert.equal(result.stage, 1);
  assert.equal(state.city.materials.inkBricks, 7);
  assert.equal(state.city.investments[0].readingId, "water-sharing-guided-v1");
  assert.equal(
    state.city.investments[0].knowledge.title,
    "一座城市如何分配有限水源？",
  );
  assert.equal(
    state.city.investments[0].knowledge.ability,
    "evidence",
  );
  assert.throws(
    () =>
      investInBuilding(state, {
        buildingId: "library",
        readingId: "water-sharing-guided-v1",
        date: "2026-07-28",
        inkBricks: 5,
      }),
    /already invested/,
  );
});

test("每日只有第一篇推進主線，故事日改領聚義印", () => {
  const storyDay = rewardVerifiedReading({
    completed: true,
    evidenceSubmitted: true,
    mainlineReward: true,
    activeDay: 7,
  });
  const extraReading = rewardVerifiedReading({
    completed: true,
    evidenceSubmitted: true,
    mainlineReward: false,
    activeDay: 7,
  });

  assert.equal(storyDay.inkBricks, 0);
  assert.equal(storyDay.fellowshipSeals, 1);
  assert.equal(storyDay.rewardType, "story");
  assert.equal(extraReading.inkBricks, 0);
  assert.equal(extraReading.fellowshipSeals, 0);
});

test("已滿五階的建築不再吞掉墨磚", () => {
  const state = createDefaultState("device-123");
  state.city.materials.inkBricks = 5;
  state.city.buildings.library = 5;

  assert.throws(
    () =>
      investInBuilding(state, {
        buildingId: "library",
        readingId: "another-reading",
        date: "2026-07-29",
        inkBricks: 5,
      }),
    /maximum stage/,
  );
  assert.equal(state.city.materials.inkBricks, 5);
  assert.equal(state.city.investments.length, 0);
});
