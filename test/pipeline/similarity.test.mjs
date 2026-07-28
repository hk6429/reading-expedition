import assert from "node:assert/strict";
import test from "node:test";

import {
  contentSimilarity,
  isTooSimilar,
} from "../../worker/src/pipeline/similarity.js";

test("高度近似來源的文字會被擋下", () => {
  const source = "海水受熱時體積會膨脹，陸地冰融化也會增加海洋水量。";
  const copied = "海水受熱時體積會膨脹，陸地冰融化也會增加海洋水量。";
  const original = "海面變高有兩條主要線索：水溫改變體積，以及陸冰進入海洋。";

  assert.equal(contentSimilarity(source, copied), 1);
  assert.equal(isTooSimilar(source, copied), true);
  assert.equal(isTooSimilar(source, original), false);
});
