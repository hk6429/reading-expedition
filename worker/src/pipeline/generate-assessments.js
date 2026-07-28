import { GenerationError } from "./generation-provider.js";
import { createBoundedPrompt } from "./prompt-boundary.js";

const ITEM_TYPES = new Set(["comprehension", "inference", "evidence"]);

function schemaError() {
  return new GenerationError(
    "generation_schema_invalid",
    "Generated assessment does not match the required schema",
  );
}

function validateItem(item, reading) {
  if (
    !ITEM_TYPES.has(item?.type) ||
    typeof item.prompt !== "string" ||
    !Array.isArray(item.options) ||
    item.options.length < 2 ||
    new Set(item.options).size !== item.options.length ||
    item.options.filter((option) => option === item.correctAnswer).length !== 1 ||
    typeof item.rationale !== "string" ||
    !item.distractorReasons ||
    typeof item.distractorReasons !== "object"
  ) {
    return false;
  }
  const distractors = item.options.filter(
    (option) => option !== item.correctAnswer,
  );
  if (
    !distractors.every(
      (option) => typeof item.distractorReasons[option] === "string",
    )
  ) {
    return false;
  }
  const span = item.evidenceSpan;
  const paragraph = reading.body[span?.paragraph - 1];
  if (
    !paragraph ||
    !Number.isInteger(span.start) ||
    !Number.isInteger(span.end) ||
    span.start < 0 ||
    span.end <= span.start ||
    span.end > paragraph.text.length ||
    paragraph.text.slice(span.start, span.end) !== span.text
  ) {
    return false;
  }
  return true;
}

export async function generateAssessments(provider, reading, factPack = null) {
  const result = await provider.generate(
    createBoundedPrompt({
      task:
        "為已發布文字產生理解、推論與文證題；每題只能有一個答案，並說明每個干擾選項。",
      factPack: factPack ?? { id: reading.factPackId },
      reading,
    }),
  );
  if (
    !Array.isArray(result?.items) ||
    result.items.length === 0 ||
    !result.items.every((item) => validateItem(item, reading))
  ) {
    throw schemaError();
  }
  return structuredClone(result.items);
}
