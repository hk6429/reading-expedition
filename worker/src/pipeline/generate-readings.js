import { GenerationError } from "./generation-provider.js";
import { createBoundedPrompt } from "./prompt-boundary.js";
import { evaluateContentProfile } from "./content-profile.js";
import { compareDifficultyLevels } from "./reading-level.js";

const DIFFICULTIES = ["guided", "challenge"];

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readingValidationCode(reading, textType) {
  if (
    !reading ||
    !DIFFICULTIES.includes(reading.difficulty) ||
    reading.textType !== textType ||
    !isText(reading.title) ||
    !isText(reading.hookQuestion) ||
    !Array.isArray(reading.body) ||
    reading.body.length === 0 ||
    !reading.body.every(
      (paragraph) => isText(paragraph.id) && isText(paragraph.text),
    ) ||
    !Array.isArray(reading.glossary) ||
    !Number.isInteger(reading.readingMinutes) ||
    reading.readingMinutes < 5 ||
    reading.readingMinutes > 15
  ) {
    return "reading_structure_invalid";
  }
  const profile = evaluateContentProfile(reading);
  return profile.ok ? null : profile.reasons[0];
}

export async function generateReadings(
  provider,
  factPack,
  { textType = "vernacular" } = {},
) {
  if (factPack.verificationStatus !== "verified") {
    throw new GenerationError(
      "fact_pack_not_verified",
      "Fact pack must be verified before generation",
    );
  }
  const prompt = createBoundedPrompt({
      task:
        `依同一事實包產生 guided 與 challenge 兩份繁體中文${textType === "classical" ? "文言改寫" : "白話"}閱讀文本。輸出物件為 readings 陣列，每篇包含 difficulty、textType、title、hookQuestion、body、glossary、readingMinutes；body 每段使用 {id,text}，glossary 每項使用 {term,definition}。`,
      factPack,
      trustedRequirements:
        textType === "classical"
          ? [
              "兩篇 textType 都必須是 classical，正文各 120 到 300 字。",
              "正文分成 2 到 3 段，每段 70 到 100 個字元。",
              "語法與內容須適合七至九年級，不仿作艱深古文，不杜撰史實。",
              "每篇須有 3 到 8 則注釋，且每個 term 必須真的出現在正文。",
              "guided 與 challenge 共用事實，但 challenge 可有較複雜句式。",
              "每篇預估閱讀與理解時間 5 到 15 分鐘。",
            ]
          : [
              "兩篇 textType 都必須是 vernacular；字數只計真正的漢字，標點、數字、空白與英文字母都不計。",
              "guided 正文以 300 到 420 個漢字為目標，challenge 正文以 420 到 600 個漢字為目標；兩篇都絕不可少於 300 或多於 600 個漢字。",
              "正文固定分成 4 段，每段 110 到 130 個字元；glossary 固定輸出空陣列。",
              "challenge 必須比 guided 至少多百分之十五的正文，或明顯增加句子整合負荷。",
              "採國中素養導向情境，完整交代脈絡、衝突、證據與可檢驗的結論。",
              "不得只把來源摘要分段或堆疊條列。",
              "每篇預估閱讀與理解時間 5 到 15 分鐘。",
            ],
    });
  let lastValidationCode = "reading_collection_invalid";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await provider.generate(prompt);
    const readings = result?.readings;
    if (!Array.isArray(readings) || readings.length !== 2) {
      lastValidationCode = "reading_collection_invalid";
      continue;
    }
    if (new Set(readings.map(({ difficulty }) => difficulty)).size !== 2) {
      lastValidationCode = "reading_difficulty_pair_invalid";
      continue;
    }
    const validationCode = readings
      .map((reading) => readingValidationCode(reading, textType))
      .find(Boolean);
    if (validationCode) {
      lastValidationCode = validationCode;
      continue;
    }
    const ordered = DIFFICULTIES.map((difficulty) =>
      readings.find((item) => item.difficulty === difficulty),
    );
    if (!compareDifficultyLevels(ordered[0], ordered[1]).ok) {
      lastValidationCode = "reading_level_invalid";
      continue;
    }
    return ordered.map((reading) => ({
      ...structuredClone(reading),
      factPackId: factPack.id,
    }));
  }
  throw new GenerationError(
    lastValidationCode,
    "Generated reading failed a required content gate",
  );
}
