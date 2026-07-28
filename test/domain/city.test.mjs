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

  assert.equal(independent.inkBricks, 5);
  assert.equal(revised.inkBricks, 5);
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
  });

  assert.equal(result.stage, 1);
  assert.equal(state.city.materials.inkBricks, 7);
  assert.equal(state.city.investments[0].readingId, "water-sharing-guided-v1");
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
