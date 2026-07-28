function safeScore(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function growReadingAbilities(
  current = {},
  { completed, evidenceSubmitted, revisedCount = 0 },
) {
  const next = {
    comprehension: safeScore(current.comprehension),
    inference: safeScore(current.inference),
    evidence: safeScore(current.evidence),
  };
  if (!completed || !evidenceSubmitted) return next;
  next.comprehension += 1;
  next.inference += 1;
  next.evidence += 1 + (revisedCount > 0 ? 1 : 0);
  return next;
}
