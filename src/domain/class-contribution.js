const SKILLS = new Set(["comprehension", "inference", "evidence"]);
const CONTRIBUTION_KEYS = new Set([
  "completionProof",
  "readingId",
  "contentKey",
  "version",
]);

export function createClassContribution(input) {
  for (const key of Object.keys(input)) {
    if (!CONTRIBUTION_KEYS.has(key)) {
      throw new TypeError(`${key} is not allowed`);
    }
  }
  if (
    typeof input.completionProof !== "string" ||
    input.completionProof.length > 2_048 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(input.completionProof) ||
    typeof input.readingId !== "string" ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(input.readingId) ||
    typeof input.contentKey !== "string" ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(input.contentKey) ||
    !Number.isInteger(input.version) ||
    input.version < 1
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
