import assert from "node:assert/strict";
import test from "node:test";

import { generateReadings } from "../../worker/src/pipeline/generate-readings.js";

const factPack = {
  id: "2026-07-28-science",
  verificationStatus: "verified",
  facts: [{ claim: "海水受熱會膨脹。", sourceItemId: "s1" }],
};

test("兩種難度必須共用同一事實包並通過結構驗證", async () => {
  const variedText =
    "甲乙丙丁戊己庚辛壬癸天地人物山川風雨日月星辰學思行知信義禮智";
  const provider = {
    async generate() {
      return {
        readings: [
          {
            difficulty: "guided",
            textType: "vernacular",
            title: "海水的刻度",
            hookQuestion: "海平面為何改變？",
            body: [{
              id: "p1",
              text: `海水受熱會膨脹。${variedText.repeat(10).slice(0, 293)}`,
            }],
            glossary: [{ term: "膨脹", definition: "體積變大。" }],
            readingMinutes: 8,
          },
          {
            difficulty: "challenge",
            textType: "vernacular",
            title: "海平面變化的線索",
            hookQuestion: "如何判讀海平面變化？",
            body: [{
              id: "p1",
              text: `海水受熱會膨脹。${variedText.repeat(15).slice(0, 443)}`,
            }],
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

test("未達 300 字的白話文不得進入文章", async () => {
  const provider = {
    async generate() {
      return {
        readings: ["guided", "challenge"].map((difficulty) => ({
          difficulty,
          textType: "vernacular",
          title: "過短文章",
          hookQuestion: "這篇文章為何不合格？",
          body: [{ id: "p1", text: "不足三百字。" }],
          glossary: [],
          readingMinutes: 5,
        })),
      };
    },
  };

  await assert.rejects(
    generateReadings(provider, factPack),
    (error) => error.code === "generation_schema_invalid",
  );
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
