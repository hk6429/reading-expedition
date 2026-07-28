import assert from "node:assert/strict";
import test from "node:test";

import { buildFactPack } from "../../worker/src/pipeline/fact-pack.js";

const fact = {
  factKey: "sea-level-rate",
  claim: "全球平均海平面正在上升。",
  sourceItemId: "nasa-sea-level",
  sourceOriginId: "nasa",
  location: { field: "summary", start: 0, end: 13 },
  publishedAt: "2026-07-27T08:00:00Z",
  confidence: 0.96,
  entities: { numbers: [], dates: [], people: [], units: [] },
};

test("事實包的每項事實都保存來源、位置、日期與信心", () => {
  const pack = buildFactPack({
    id: "2026-07-28-science",
    topicDate: "2026-07-28",
    category: "science",
    topicKind: "evergreen",
    facts: [fact],
  });

  assert.equal(pack.verificationStatus, "verified");
  assert.equal(pack.facts[0].sourceItemId, "nasa-sea-level");
  assert.deepEqual(pack.facts[0].location, { field: "summary", start: 0, end: 13 });
  assert.equal(pack.facts[0].confidence, 0.96);
});

test("新聞或爭議主題必須有兩個獨立原始來源", () => {
  assert.throws(
    () =>
      buildFactPack({
        id: "news",
        topicDate: "2026-07-28",
        category: "world",
        topicKind: "news",
        facts: [fact],
      }),
    /independent sources/,
  );
  assert.throws(
    () =>
      buildFactPack({
        id: "copied-news",
        topicDate: "2026-07-28",
        category: "world",
        topicKind: "news",
        facts: [
          fact,
          { ...fact, sourceItemId: "syndicated-copy", sourceOriginId: "nasa" },
        ],
      }),
    /independent sources/,
  );
});
