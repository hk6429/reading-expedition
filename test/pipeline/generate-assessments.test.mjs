import assert from "node:assert/strict";
import test from "node:test";

import { generateAssessments } from "../../worker/src/pipeline/generate-assessments.js";

const reading = {
  id: "science-guided",
  factPackId: "2026-07-28-science",
  difficulty: "guided",
  body: [{ id: "p1", text: "海水受熱會膨脹，陸地冰融化也會增加海水。" }],
};

test("每題有唯一答案、干擾理由及發布文本內的文證", async () => {
  const provider = {
    async generate() {
      return {
        items: [
          {
            type: "comprehension",
            prompt: "海水受熱會如何？",
            options: ["膨脹", "消失", "結冰"],
            correctAnswer: "膨脹",
            rationale: "第一段直接說明。",
            distractorReasons: {
              消失: "原文沒有提到。",
              結冰: "與受熱相反。",
            },
            evidenceSpan: {
              paragraph: 1,
              start: 0,
              end: 7,
              text: "海水受熱會膨脹",
            },
          },
        ],
      };
    },
  };

  const items = await generateAssessments(provider, reading);

  assert.equal(items[0].correctAnswer, "膨脹");
  assert.equal(items[0].evidenceSpan.text, "海水受熱會膨脹");
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
