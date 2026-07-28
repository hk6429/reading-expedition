import assert from "node:assert/strict";
import test from "node:test";

import { generateReadings } from "../../worker/src/pipeline/generate-readings.js";

const factPack = {
  id: "2026-07-28-science",
  verificationStatus: "verified",
  facts: [{ claim: "海水受熱會膨脹。", sourceItemId: "s1" }],
};

test("兩種難度必須共用同一事實包並通過結構驗證", async () => {
  const provider = {
    async generate() {
      return {
        readings: [
          {
            difficulty: "guided",
            title: "海水的刻度",
            hookQuestion: "海平面為何改變？",
            body: [{ id: "p1", text: "海水受熱會膨脹。" }],
            glossary: [{ term: "膨脹", meaning: "體積變大" }],
            readingMinutes: 8,
          },
          {
            difficulty: "challenge",
            title: "海平面變化的線索",
            hookQuestion: "如何判讀海平面變化？",
            body: [{ id: "p1", text: "海水受熱會膨脹。" }],
            glossary: [],
            readingMinutes: 10,
          },
        ],
      };
    },
  };

  const readings = await generateReadings(provider, factPack);

  assert.deepEqual(readings.map(({ difficulty }) => difficulty), ["guided", "challenge"]);
  assert.ok(readings.every(({ factPackId }) => factPackId === factPack.id));
});

test("衝突事實包與不完整 JSON 不得進入文章", async () => {
  const provider = { async generate() { return { readings: [] }; } };

  await assert.rejects(
    generateReadings(provider, { ...factPack, verificationStatus: "conflicted" }),
    /verified/,
  );
  await assert.rejects(
    generateReadings(provider, factPack),
    (error) => error.code === "generation_schema_invalid",
  );
});
