const CATEGORIES = new Set(["world", "science", "humanities"]);
const SKILLS = new Set(["comprehension", "inference", "evidence"]);
const CONTRIBUTION_KEYS = new Set([
  "validReading",
  "contentId",
  "category",
  "skill",
  "period",
]);

export function createClassContribution(input) {
  for (const key of Object.keys(input)) {
    if (!CONTRIBUTION_KEYS.has(key)) {
      throw new TypeError(`${key} is not allowed`);
    }
  }
  if (
    input.validReading !== true ||
    typeof input.contentId !== "string" ||
    !/^[A-Za-z0-9-]{1,120}$/.test(input.contentId) ||
    !CATEGORIES.has(input.category) ||
    !SKILLS.has(input.skill) ||
    !/^\d{4}-W\d{2}$/.test(input.period)
  ) {
    throw new TypeError("class contribution is invalid");
  }
  return Object.freeze({ ...input });
}

export function createStructuredHint({ focus, messageKey }) {
  if (!SKILLS.has(focus) || !["return_to_paragraph", "compare_options", "check_reason"].includes(messageKey)) {
    throw new TypeError("structured hint is invalid");
  }
  return Object.freeze({ focus, messageKey });
}
