import assert from "node:assert/strict";
import test from "node:test";

import {
  crossCheckFacts,
  sensitivityFlagsFor,
} from "../../worker/src/pipeline/cross-check.js";

function fact(sourceOriginId, entities) {
  return {
    factKey: "temperature-record",
    claim: "測站記錄到新的高溫。",
    sourceItemId: `${sourceOriginId}-item`,
    sourceOriginId,
    location: { field: "summary", start: 0, end: 10 },
    publishedAt: "2026-07-27T08:00:00Z",
    confidence: 0.9,
    entities,
  };
}

test("數字、日期、人名或單位衝突時不得進入生成", () => {
  const result = crossCheckFacts([
    fact("source-a", {
      numbers: ["38"],
      dates: ["2026-07-27"],
      people: [],
      units: ["°C"],
    }),
    fact("source-b", {
      numbers: ["40"],
      dates: ["2026-07-27"],
      people: [],
      units: ["°C"],
    }),
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.conflicts[0].field, "numbers");
});

test("戰爭、災難、死亡、犯罪、性別暴力、政治與重大健康強制人工審核", () => {
  const flags = sensitivityFlagsFor(
    "颱風災難造成死亡，政府討論疫情與政治責任。",
  );

  assert.deepEqual(
    new Set(flags),
    new Set(["disaster", "death", "politics", "major_health"]),
  );
});
