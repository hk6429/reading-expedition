const ALLOWED_KEYS = Object.freeze([
  "id",
  "date",
  "category",
  "skill",
  "evidence",
]);

export function buildWeeklyReview(records = []) {
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!ALLOWED_KEYS.includes(key)) throw new TypeError(`${key} is not allowed`);
    }
  }
  const valid = records.filter(
    ({ id, date, evidence }) =>
      typeof id === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      typeof evidence === "string" &&
      evidence.trim().length > 0,
  );
  return Object.freeze({
    validReadings: valid.length,
    categories: [...new Set(valid.map(({ category }) => category).filter(Boolean))],
    skills: [...new Set(valid.map(({ skill }) => skill).filter(Boolean))],
    evidence: valid.map(({ id, evidence }) => ({ id, evidence })),
  });
}
