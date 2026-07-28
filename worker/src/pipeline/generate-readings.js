import { GenerationError } from "./generation-provider.js";
import { createBoundedPrompt } from "./prompt-boundary.js";
import { evaluateContentProfile } from "./content-profile.js";

const DIFFICULTIES = ["guided", "challenge"];

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateReading(reading, textType) {
  return (
    reading &&
    DIFFICULTIES.includes(reading.difficulty) &&
    reading.textType === textType &&
    isText(reading.title) &&
    isText(reading.hookQuestion) &&
    Array.isArray(reading.body) &&
    reading.body.length > 0 &&
    reading.body.every(
      (paragraph) => isText(paragraph.id) && isText(paragraph.text),
    ) &&
    Array.isArray(reading.glossary) &&
    Number.isInteger(reading.readingMinutes) &&
    reading.readingMinutes >= 5 &&
    reading.readingMinutes <= 15 &&
    evaluateContentProfile(reading).ok
  );
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
  const result = await provider.generate(
    createBoundedPrompt({
      task:
        `依同一事實包產生 guided 與 challenge 兩份繁體中文${textType === "classical" ? "文言改寫" : "白話"}閱讀文本。輸出物件為 readings 陣列，每篇包含 difficulty、textType、title、hookQuestion、body、glossary、readingMinutes；body 每段使用 {id,text}，glossary 每項使用 {term,definition}。`,
      factPack,
      trustedRequirements:
        textType === "classical"
          ? [
              "兩篇 textType 都必須是 classical，正文各 120 到 300 字。",
              "語法與內容須適合七至九年級，不仿作艱深古文，不杜撰史實。",
              "每篇須有 3 到 8 則注釋，且每個 term 必須真的出現在正文。",
              "guided 與 challenge 共用事實，但 challenge 可有較複雜句式。",
              "每篇預估閱讀與理解時間 5 到 15 分鐘。",
            ]
          : [
              "兩篇 textType 都必須是 vernacular，正文各 300 到 600 個中文字。",
              "guided 建議 300 到 450 字，challenge 建議 450 到 600 字。",
              "採國中素養導向情境，完整交代脈絡、衝突、證據與可檢驗的結論。",
              "不得只把來源摘要分段或堆疊條列。",
              "每篇預估閱讀與理解時間 5 到 15 分鐘。",
            ],
    }),
  );
  const readings = result?.readings;
  if (
    !Array.isArray(readings) ||
    readings.length !== 2 ||
    !readings.every((reading) => validateReading(reading, textType)) ||
    new Set(readings.map(({ difficulty }) => difficulty)).size !== 2
  ) {
    throw new GenerationError(
      "generation_schema_invalid",
      "Generated readings do not match the required schema",
    );
  }
  return DIFFICULTIES.map((difficulty) => ({
    ...structuredClone(readings.find((item) => item.difficulty === difficulty)),
    factPackId: factPack.id,
  }));
}
