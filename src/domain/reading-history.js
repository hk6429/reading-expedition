const CATEGORIES = new Set(["world", "science", "humanities"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[A-Za-z0-9-]{1,120}$/;

export function hasMainlineRewardForDate(history = [], date) {
  return history.some(
    (event) => event.date === date && event.mainlineReward === true,
  );
}

export function appendVerifiedReading(history = [], input) {
  if (
    !Array.isArray(history) ||
    !input ||
    !ID_PATTERN.test(input.readingId) ||
    !DATE_PATTERN.test(input.date) ||
    !CATEGORIES.has(input.category) ||
    input.skill !== "evidence" ||
    typeof input.evidence !== "string" ||
    input.evidence.trim().length === 0
  ) {
    throw new TypeError("verified reading event is invalid");
  }

  const id = `${input.readingId}:${input.date}`;
  const existing = history.find((event) => event.id === id);
  if (existing) {
    return Object.freeze({
      added: false,
      event: existing,
      history: [...history],
    });
  }

  const event = Object.freeze({
    id,
    readingId: input.readingId,
    date: input.date,
    category: input.category,
    skill: input.skill,
    evidence: input.evidence.trim(),
    mainlineReward: !hasMainlineRewardForDate(history, input.date),
  });
  return Object.freeze({
    added: true,
    event,
    history: [...history, event],
  });
}
