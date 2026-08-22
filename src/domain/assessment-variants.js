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
      instruction: "先排除只談局部細節的選項，再選出最能涵蓋全文的答案。",
      stem: "全文焦點是：",
    }),
    Object.freeze({
      id: "information-sorting",
      label: "訊息整理",
      instruction: "把關鍵人物、事件與結果整理好，再選出資訊最完整的答案。",
      stem: "請重新判斷：",
    }),
  ]),
  inference: Object.freeze([
    Object.freeze({
      id: "clue-connection",
      label: "線索串聯",
      instruction: "先找兩個能互相支持的線索，再排除超出原文的猜測。",
      stem: "依這個判準推想：",
    }),
    Object.freeze({
      id: "cross-paragraph-reasoning",
      label: "跨段判讀",
      instruction: "比較前後文的原因與結果，選出推論幅度最合適的一項。",
      stem: "跨段比對後回答：",
    }),
  ]),
  evidence: Object.freeze([
    Object.freeze({
      id: "claim-evidence-match",
      label: "主張配證據",
      instruction: "逐一檢查四個選項，找出與原文支持關係最直接的一項。",
      stem: "文證任務：",
    }),
    Object.freeze({
      id: "evidence-strength",
      label: "證據強度",
      instruction: "比較各選項涵蓋的範圍，選出沒有斷章取義的文證。",
      stem: "支持力比對：",
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

function rotateOptions(options, offset) {
  const start = offset % options.length;
  return [...options.slice(start), ...options.slice(0, start)];
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
    const optionOffset = stableIndex(
      `${seed}:options`,
      item,
      index,
      item.options.length,
    );
    return Object.freeze({
      ...item,
      originalPrompt: item.prompt,
      prompt: `${frame.instruction} ${frame.stem}${item.prompt}`,
      options: Object.freeze(rotateOptions(item.options, optionOffset)),
      variantId: frame.id,
      variantLabel: frame.label,
    });
  });
}

export function rotateAssessmentSessionSeed(
  storage,
  { createSeed = () => globalThis.crypto.randomUUID() } = {},
) {
  if (!storage?.setItem) {
    throw new TypeError("sessionStorage-compatible storage is required");
  }
  const next = assertSeed(createSeed());
  storage.setItem(SESSION_SEED_KEY, next);
  return next;
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
