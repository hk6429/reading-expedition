import assert from "node:assert/strict";
import test from "node:test";

import { generateAssessments } from "../../worker/src/pipeline/generate-assessments.js";

const reading = {
  id: "science-guided",
  factPackId: "2026-07-28-science",
  difficulty: "guided",
  body: [{ id: "p1", text: "海水受熱會膨脹，陸地冰融化也會增加海水。" }],
};

function item(type, prompt, correctAnswer, evidenceSpan) {
  const options = [correctAnswer, `${type}誤一`, `${type}誤二`, `${type}誤三`];
  return {
    type,
    prompt,
    options,
    correctAnswer,
    rationale: "依正文線索可判斷。",
    distractorReasons: Object.fromEntries(
      options.slice(1).map((option, index) => [
        option,
        `這是第 ${index + 1} 種常見誤讀。`,
      ]),
    ),
    evidenceSpan,
  };
}

test("每題有唯一答案、干擾理由及發布文本內的文證", async () => {
  const provider = {
    async generate() {
      return {
        items: [
          item(
            "comprehension",
            "海水受熱會如何？",
            "膨脹",
            {
              paragraph: 1,
              start: 0,
              end: 7,
              text: "海水受熱會膨脹",
            },
          ),
          item(
            "inference",
            "依文章推論，哪些因素會增加海水？",
            "受熱與陸冰融化",
            {
              paragraph: 1,
              start: 0,
              end: 19,
              text: "海水受熱會膨脹，陸地冰融化也會增加海水",
            },
          ),
          item(
            "evidence",
            "哪一段可支持前述推論？",
            "第一段",
            {
              paragraph: 1,
              start: 0,
              end: 19,
              text: "海水受熱會膨脹，陸地冰融化也會增加海水",
            },
          ),
        ],
      };
    },
  };

  const items = await generateAssessments(provider, reading);

  assert.equal(items[0].correctAnswer, "膨脹");
  assert.equal(items[0].evidenceSpan.text, "海水受熱會膨脹");
});

test("空白題幹、空白解析或套版干擾理由會被拒絕", async () => {
  const provider = {
    async generate() {
      return {
        items: ["comprehension", "inference", "evidence"].map((type) => ({
          ...item(type, " ", "答案", {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          }),
          rationale: " ",
          distractorReasons: {
            [`${type}誤一`]: "同一句套版理由",
            [`${type}誤二`]: "同一句套版理由",
            [`${type}誤三`]: "同一句套版理由",
          },
        })),
      };
    },
  };

  await assert.rejects(
    generateAssessments(provider, reading),
    (error) => error.code === "generation_schema_invalid",
  );
});

test("重複答案或不在發布文字內的文證會被拒絕", async () => {
  const provider = {
    async generate() {
      return {
        items: [
          {
            type: "evidence",
            prompt: "哪一句是文證？",
            options: ["同一答案", "同一答案"],
            correctAnswer: "同一答案",
            rationale: "理由",
            distractorReasons: {},
            evidenceSpan: { paragraph: 1, start: 0, end: 4, text: "不存在" },
          },
        ],
      };
    },
  };

  await assert.rejects(
    generateAssessments(provider, reading),
    (error) => error.code === "generation_schema_invalid",
  );
});

test("題組必須依序包含三種能力且每題固定四選一", async () => {
  const provider = {
    async generate() {
      return {
        items: [
          item("comprehension", "題一", "答案一", {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          }),
          item("evidence", "順序錯誤", "答案二", {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          }),
          item("inference", "順序錯誤", "答案三", {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          }),
        ],
      };
    },
  };

  await assert.rejects(
    generateAssessments(provider, reading),
    (error) => error.code === "generation_schema_invalid",
  );
});
