const GATES = Object.freeze({
  source_traceable: ({ sourceTraceable }) => sourceTraceable === true,
  license_clear: ({ licenseClear }) => licenseClear === true,
  fact_pack_verified: ({ factPackVerified }) => factPackVerified === true,
  shared_facts: ({ twoDifficultiesShareFacts }) =>
    twoDifficultiesShareFacts === true,
  originality: ({ similarity }) =>
    typeof similarity === "number" && similarity < 0.78,
  assessment_valid: ({ assessmentValid }) => assessmentValid === true,
  reading_level_valid: ({ readingLevelValid }) =>
    readingLevelValid === true,
  content_profile_valid: ({ contentProfileValid }) =>
    contentProfileValid === true,
  schema_valid: ({ schemaValid }) => schemaValid === true,
});

export function evaluateHardGates(input) {
  const failed = Object.entries(GATES)
    .filter(([, check]) => !check(input))
    .map(([name]) => name);
  return Object.freeze({ passed: failed.length === 0, failed });
}

export function decidePublication({
  hardGates,
  qualityScore,
  formalDay,
  sensitivityFlags,
}) {
  if (!hardGates.passed) {
    return { status: "blocked", reasons: hardGates.failed };
  }
  const reasons = [];
  if (qualityScore < 92) reasons.push("quality_below_92");
  if (!Number.isInteger(formalDay) || formalDay <= 30) {
    reasons.push("first_30_formal_days");
  }
  if (sensitivityFlags.length > 0) reasons.push("sensitive_topic");
  return reasons.length > 0
    ? { status: "manual_review", reasons }
    : { status: "eligible_for_auto_publish", reasons: [] };
}
