import assert from "node:assert/strict";
import test from "node:test";

import { selectDailyCandidates } from "../../worker/src/pipeline/fallback-candidates.js";

test("三類各選一個；缺文時用近七日未發布合格候選", () => {
  const result = selectDailyCandidates({
    date: "2026-07-28",
    fresh: [
      { id: "world-today", category: "world", score: 96, published: false },
      { id: "science-today", category: "science", score: 94, published: false },
    ],
    fallback: [
      {
        id: "humanities-old",
        category: "humanities",
        score: 95,
        published: false,
        candidateDate: "2026-07-23",
      },
    ],
  });

  assert.deepEqual(
    result.map(({ id }) => id),
    ["world-today", "science-today", "humanities-old"],
  );
});

test("仍不足時允許只產出一至兩類，不捏造候選", () => {
  const result = selectDailyCandidates({
    date: "2026-07-28",
    fresh: [
      { id: "world-today", category: "world", score: 96, published: false },
    ],
    fallback: [],
  });

  assert.deepEqual(result.map(({ id }) => id), ["world-today"]);
});
