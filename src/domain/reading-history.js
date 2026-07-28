const CATEGORIES = new Set(["world", "science", "humanities"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[A-Za-z0-9-]{1,120}$/;

export function extractEvidenceText(reading, span) {
  const paragraph = reading?.body?.[Number(span?.paragraph) - 1];
  const text = typeof paragraph === "string" ? paragraph : paragraph?.text;
  if (typeof text !== "string") return "";
  const start = Math.max(0, Math.min(text.length, Number(span?.start) || 0));
  const end = Math.max(start, Math.min(text.length, Number(span?.end) || start));
  return text.slice(start, end).trim();
}

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
    title:
      typeof input.title === "string" && input.title.trim()
        ? input.title.trim()
        : "已完成的讀卷",
    evidence: input.evidence.trim(),
    mainlineReward: !hasMainlineRewardForDate(history, input.date),
  });
  return Object.freeze({
    added: true,
    event,
    history: [...history, event],
  });
}
