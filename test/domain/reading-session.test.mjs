import assert from "node:assert/strict";
import test from "node:test";

import { createReadingSession } from "../../src/domain/reading-session.js";

test("閱讀位置立即寫入本機狀態並可切換對應難度", () => {
  const saved = [];
  const state = { readingProgress: {} };
  const session = createReadingSession(state, (next) => {
    saved.push(structuredClone(next));
  });

  session.updatePosition("water-guided", {
    contentKey: "water",
    paragraph: 2,
    offset: 10,
    progress: 0.5,
  });
  const target = session.positionForSwitch("water", "water-challenge", 4);

  assert.equal(saved.length, 1);
  assert.equal(state.readingProgress["water-guided"].paragraph, 2);
  assert.deepEqual(target, {
    paragraph: 2,
    offset: 0,
    progress: 0.5,
  });
});

test("閱讀進度限制在有效範圍", () => {
  const session = createReadingSession({ readingProgress: {} }, () => {});

  assert.throws(
    () =>
      session.updatePosition("reading", {
        contentKey: "water",
        paragraph: -1,
        offset: 0,
        progress: 0,
      }),
    /paragraph/,
  );
  assert.throws(
    () =>
      session.updatePosition("reading", {
        contentKey: "water",
        paragraph: 1,
        offset: 0,
        progress: 1.2,
      }),
    /progress/,
  );
});
