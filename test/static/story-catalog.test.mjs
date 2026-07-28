import assert from "node:assert/strict";
import test from "node:test";

import { openingStoryBeats } from "../../src/data/story-catalog.js";

test("首週故事服務閱讀，每次最多兩句且每句不超過三十字", () => {
  assert.equal(openingStoryBeats.length, 7);

  for (const beat of openingStoryBeats) {
    assert.ok(Number.isInteger(beat.activeDay));
    assert.ok(beat.lines.length >= 1 && beat.lines.length <= 2);
    for (const line of beat.lines) {
      assert.ok([...line].length <= 30, `${beat.id} 過長：${line}`);
    }
  }
});

test("故事不使用傷害、賭博或焦慮機制推動學生", () => {
  assert.doesNotMatch(
    JSON.stringify(openingStoryBeats),
    /擊殺|殺死|處刑|斷簽|歸零|限時|排行榜|賭|抽卡/,
  );
});
