function safeScore(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function growReadingAbilities(
  current = {},
  { completed, items = [] },
) {
  const next = {
    comprehension: safeScore(current.comprehension),
    inference: safeScore(current.inference),
    evidence: safeScore(current.evidence),
  };
  if (!completed) return next;
  for (const item of items) {
    if (
      item?.firstCorrect &&
      Object.hasOwn(next, item.type)
    ) {
      next[item.type] += 1;
    }
  }
  return next;
}
