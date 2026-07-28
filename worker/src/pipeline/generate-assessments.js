import { GenerationError } from "./generation-provider.js";
import { createBoundedPrompt } from "./prompt-boundary.js";

const ITEM_TYPES = Object.freeze(["comprehension", "inference", "evidence"]);
const ITEM_TYPE_SET = new Set(ITEM_TYPES);

function schemaError(code = "assessment_generation_schema_invalid") {
  return new GenerationError(
    code,
    "Generated assessment does not match the required schema",
  );
}

function paragraphText(paragraph) {
  return typeof paragraph === "string" ? paragraph : paragraph?.text;
}

function normalizeCorrectAnswer(value, options) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const labels = ["A", "B", "C", "D", "甲", "乙", "丙", "丁", "1", "2", "3", "4"];
  const labelIndex = labels.indexOf(trimmed);
  if (labelIndex >= 0) return options[labelIndex % 4];
  const prefixed = trimmed.match(/^(?:選項)?([ABCD甲乙丙丁1-4])[.、：:\s]/);
  if (prefixed) {
    const index = labels.indexOf(prefixed[1]);
    return options[index % 4];
  }
  if (trimmed.length <= 8) {
    const compact = trimmed.match(/[ABCD甲乙丙丁1-4]/g) ?? [];
    if (compact.length === 1) {
      const index = labels.indexOf(compact[0]);
      return options[index % 4];
    }
  }
  return trimmed;
}

function normalizeReasonKey(key, options) {
  const normalized = normalizeCorrectAnswer(key, options);
  return options.includes(normalized) ? normalized : key.trim();
}

function normalizeReasons(rawReasons, options, correctAnswer) {
  if (Array.isArray(rawReasons)) {
    if (rawReasons.length === options.length) {
      return Object.fromEntries(
        options
          .map((option, index) => [option, rawReasons[index]])
          .filter(([option]) => option !== correctAnswer)
          .map(([option, reason]) => [
            option,
            typeof reason === "string" ? reason.trim() : reason,
          ]),
      );
    }
    const distractors = options.filter((option) => option !== correctAnswer);
    if (rawReasons.length === distractors.length) {
      return Object.fromEntries(
        distractors.map((option, index) => [
          option,
          typeof rawReasons[index] === "string"
            ? rawReasons[index].trim()
            : rawReasons[index],
        ]),
      );
    }
  }
  return Object.fromEntries(
    Object.entries(rawReasons ?? {}).map(([option, reason]) => [
      normalizeReasonKey(option, options),
      typeof reason === "string" ? reason.trim() : reason,
    ]),
  );
}

function normalizeItem(item, reading) {
  const options = Array.isArray(item?.options)
    ? item.options.map((option) =>
        typeof option === "string" ? option.trim() : option,
      )
    : item?.options;
  const correctAnswer = Number.isInteger(item?.correctIndex)
    ? options?.[item.correctIndex]
    : normalizeCorrectAnswer(item?.correctAnswer, options ?? []);
  const reasons = normalizeReasons(
    item?.distractorReasons,
    options ?? [],
    correctAnswer,
  );
  const evidenceText =
    typeof item?.evidenceSpan?.text === "string"
      ? item.evidenceSpan.text.trim()
      : "";
  let paragraphIndex = Number.isInteger(item?.evidenceSpan?.paragraph)
    ? item.evidenceSpan.paragraph - 1
    : -1;
  let paragraph = paragraphText(reading.body[paragraphIndex]);
  let start = paragraph?.indexOf(evidenceText) ?? -1;
  if (start < 0 && evidenceText) {
    paragraphIndex = reading.body.findIndex((candidate) =>
      paragraphText(candidate)?.includes(evidenceText),
    );
    paragraph = paragraphText(reading.body[paragraphIndex]);
    start = paragraph?.indexOf(evidenceText) ?? -1;
  }
  const { correctIndex: _correctIndex, ...normalizedItem } = item ?? {};
  return {
    ...normalizedItem,
    prompt: typeof item?.prompt === "string" ? item.prompt.trim() : item?.prompt,
    options,
    correctAnswer,
    rationale:
      typeof item?.rationale === "string"
        ? item.rationale.trim()
        : item?.rationale,
    distractorReasons: reasons,
    evidenceSpan: {
      paragraph: paragraphIndex + 1,
      start,
      end: start < 0 ? -1 : start + evidenceText.length,
      text: evidenceText,
    },
  };
}

function itemValidationCode(item, reading) {
  const normalizedOptions = Array.isArray(item?.options)
    ? item.options.map((option) =>
        typeof option === "string" ? option.trim() : "",
      )
    : [];
  if (
    !ITEM_TYPE_SET.has(item?.type) ||
    typeof item.prompt !== "string" ||
    item.prompt.trim().length === 0 ||
    !Array.isArray(item.options) ||
    item.options.length !== 4 ||
    normalizedOptions.some((option) => option.length === 0) ||
    new Set(normalizedOptions).size !== item.options.length ||
    item.options.filter((option) => option === item.correctAnswer).length !== 1 ||
    typeof item.rationale !== "string" ||
    item.rationale.trim().length === 0 ||
    !item.distractorReasons ||
    typeof item.distractorReasons !== "object"
  ) {
    return "assessment_structure_invalid";
  }
  const distractors = item.options.filter(
    (option) => option !== item.correctAnswer,
  );
  if (
    !distractors.every(
      (option) =>
        typeof item.distractorReasons[option] === "string" &&
        item.distractorReasons[option].trim().length > 0,
    )
  ) {
    return "assessment_distractors_invalid";
  }
  if (
    new Set(
      distractors.map((option) => item.distractorReasons[option].trim()),
    ).size !== distractors.length
  ) {
    return "assessment_distractors_invalid";
  }
  const span = item.evidenceSpan;
  const rawParagraph = reading.body[span?.paragraph - 1];
  const paragraph =
    typeof rawParagraph === "string" ? rawParagraph : rawParagraph?.text;
  if (
    !paragraph ||
    !Number.isInteger(span.start) ||
    !Number.isInteger(span.end) ||
    span.start < 0 ||
    span.end <= span.start ||
    span.end > paragraph.length ||
    paragraph.slice(span.start, span.end) !== span.text
  ) {
    return "assessment_evidence_invalid";
  }
  return null;
}

export async function generateAssessments(provider, reading, factPack = null) {
  const result = await provider.generate(
    createBoundedPrompt({
      task:
        "為已發布文字產生一組國中教育會考式素養閱讀題。輸出物件為 items 陣列；依序各產生一題 comprehension、inference、evidence。每題用 correctIndex（0 到 3）標示正解；distractorReasons 固定為四格非空字串陣列，依序解釋四個選項為何正確或錯誤。",
      factPack: factPack ?? { id: reading.factPackId },
      reading,
      trustedRequirements: [
        "固定三題，能力依序為擷取與理解、比較統整與推論、文證判讀與評鑑。",
        "每題固定四個選項，只有一個正確或最佳答案。",
        "correctIndex 必須是正確選項的零起算位置，不另輸出 correctAnswer。",
        "干擾選項須分別對應常見誤讀、過度推論、局部訊息或因果倒置，不得荒謬到可直接排除。",
        "distractorReasons 依四個選項順序排列；正解位置也要寫明成立原因，另外三則錯誤理由不可重複。",
        "每題都須提供 rationale、每個錯誤選項的 distractorReasons，以及正文內可逐字對應的 evidenceSpan；文證請摘錄 8 到 30 個連續字元，不得改寫。",
        "不得考來源以外的冷知識，也不得只靠題幹常識作答。",
        "題目語氣參考會考與學測的閱讀歷程，但不得複製歷屆題目文字。",
      ],
    }),
  );
  const items = Array.isArray(result?.items)
    ? result.items.map((item) => normalizeItem(item, reading))
    : null;
  if (
    !items ||
    items.length !== ITEM_TYPES.length
  ) {
    throw schemaError("assessment_collection_invalid");
  }
  if (items.some((item, index) => item.type !== ITEM_TYPES[index])) {
    throw schemaError("assessment_types_invalid");
  }
  const validationCode = items
    .map((item) => itemValidationCode(item, reading))
    .find(Boolean);
  if (validationCode) {
    throw schemaError(validationCode);
  }
  return structuredClone(items);
}
