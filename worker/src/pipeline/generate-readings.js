import { GenerationError } from "./generation-provider.js";
import { createBoundedPrompt } from "./prompt-boundary.js";

const DIFFICULTIES = ["guided", "challenge"];

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateReading(reading) {
  return (
    reading &&
    DIFFICULTIES.includes(reading.difficulty) &&
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
    reading.readingMinutes <= 15
  );
}

export async function generateReadings(provider, factPack) {
  if (factPack.verificationStatus !== "verified") {
    throw new GenerationError(
      "fact_pack_not_verified",
      "Fact pack must be verified before generation",
    );
  }
  const result = await provider.generate(
    createBoundedPrompt({
      task:
        "依同一事實包產生 guided 與 challenge 兩份繁體中文閱讀文本，讀時各 5 到 15 分鐘。",
      factPack,
    }),
  );
  const readings = result?.readings;
  if (
    !Array.isArray(readings) ||
    readings.length !== 2 ||
    !readings.every(validateReading) ||
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
