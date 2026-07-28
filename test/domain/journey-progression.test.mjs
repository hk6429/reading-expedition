import assert from "node:assert/strict";
import test from "node:test";

import {
  STORY_ACTIVE_DAYS,
  journeyRewardForActiveDay,
} from "../../src/domain/journey-progression.js";

test("三十日航程由二十次建城與十次故事解鎖組成", () => {
  const rewards = Array.from({ length: 30 }, (_, index) =>
    journeyRewardForActiveDay(index + 1),
  );

  assert.equal(
    rewards.filter(({ type }) => type === "building").length,
    20,
  );
  assert.equal(
    rewards.filter(({ type }) => type === "story").length,
    10,
  );
  assert.deepEqual(STORY_ACTIVE_DAYS, [3, 5, 7, 10, 14, 17, 21, 24, 27, 30]);
});

test("建城日給五塊墨磚，故事日給一枚聚義印且不製造限時焦慮", () => {
  const building = journeyRewardForActiveDay(1);
  const story = journeyRewardForActiveDay(7);

  assert.deepEqual(building, {
    activeDay: 1,
    type: "building",
    inkBricks: 5,
    fellowshipSeals: 0,
    title: "修築浮城",
  });
  assert.equal(story.type, "story");
  assert.equal(story.inkBricks, 0);
  assert.equal(story.fellowshipSeals, 1);
  assert.match(story.title, /回顧|解鎖|聚義|航圖|故事/);
  assert.doesNotMatch(JSON.stringify(story), /限時|歸零|斷簽|失去/);
});
