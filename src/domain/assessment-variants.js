const SESSION_SEED_KEY = "reading-expedition:assessment-seed";
const ABILITY_TYPES = Object.freeze([
  "comprehension",
  "inference",
  "evidence",
]);
const SAFE_SEED = /^[A-Za-z0-9._:-]{8,128}$/;

export const ASSESSMENT_VARIANT_FRAMES = Object.freeze({
  comprehension: Object.freeze([
    Object.freeze({
      id: "main-idea-navigation",
      label: "主旨導航",
      prefix: "先抓住全文重點，再完成這項任務",
    }),
    Object.freeze({
      id: "information-sorting",
      label: "訊息整理",
      prefix: "整理關鍵訊息後，判斷最合適的答案",
    }),
  ]),
  inference: Object.freeze([
    Object.freeze({
      id: "clue-connection",
      label: "線索串聯",
      prefix: "把文中線索連起來，再完成這項推論",
    }),
    Object.freeze({
      id: "cross-paragraph-reasoning",
      label: "跨段判讀",
      prefix: "綜合前後文，不超出證據範圍來判斷",
    }),
  ]),
  evidence: Object.freeze([
    Object.freeze({
      id: "claim-evidence-match",
      label: "主張配證據",
      prefix: "先比對主張與原文證據，再選出答案",
    }),
    Object.freeze({
      id: "evidence-strength",
      label: "證據強度",
      prefix: "回到原文，判斷哪項證據支持得最完整",
    }),
  ]),
});

function assertSeed(seed) {
  if (typeof seed !== "string" || !SAFE_SEED.test(seed)) {
    throw new TypeError("assessment session seed is invalid");
  }
  return seed;
}

function assertAssessmentItem(item) {
  if (!item || typeof item !== "object") {
    throw new TypeError("assessment item is required");
  }
  if (typeof item.id !== "string" || !item.id.trim()) {
    throw new TypeError("assessment item id is invalid");
  }
  if (!ABILITY_TYPES.includes(item.type)) {
    throw new TypeError("assessment ability type is unsupported");
  }
  if (typeof item.prompt !== "string" || !item.prompt.trim()) {
    throw new TypeError("assessment prompt is invalid");
  }
  if (
    !Array.isArray(item.options) ||
    item.options.length !== 4 ||
    new Set(item.options).size !== 4 ||
    item.options.some((option) => typeof option !== "string" || !option.trim())
  ) {
    throw new TypeError("assessment item must have four options");
  }
}

function stableIndex(seed, item, itemIndex, length) {
  const source = `${seed}:${item.id}:${item.type}:${itemIndex}`;
  const score = [...source].reduce(
    (sum, character, index) =>
      (sum + character.codePointAt(0) * (index + 1)) >>> 0,
    0,
  );
  return score % length;
}

export function createAssessmentVariantSet(items, { seed }) {
  assertSeed(seed);
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError("assessment items are required");
  }
  return items.map((item, index) => {
    assertAssessmentItem(item);
    const frames = ASSESSMENT_VARIANT_FRAMES[item.type];
    const frame = frames[stableIndex(seed, item, index, frames.length)];
    return Object.freeze({
      ...item,
      originalPrompt: item.prompt,
      prompt: `${frame.prefix}｜${item.prompt}`,
      variantId: frame.id,
      variantLabel: frame.label,
    });
  });
}

export function getAssessmentSessionSeed(
  storage,
  { createSeed = () => globalThis.crypto.randomUUID() } = {},
) {
  if (!storage?.getItem || !storage?.setItem) {
    throw new TypeError("sessionStorage-compatible storage is required");
  }
  const stored = storage.getItem(SESSION_SEED_KEY);
  if (typeof stored === "string" && SAFE_SEED.test(stored)) return stored;
  const next = assertSeed(createSeed());
  storage.setItem(SESSION_SEED_KEY, next);
  return next;
}

export const ASSESSMENT_VARIANT_STORAGE_KEY = SESSION_SEED_KEY;
