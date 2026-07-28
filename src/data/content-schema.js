export const CORE_CATEGORIES = Object.freeze([
  "world",
  "science",
  "humanities",
]);

export const CORE_DIFFICULTIES = Object.freeze(["guided", "challenge"]);

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

export function assertCoreReading(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("reading must be an object");
  }
  assertNonEmptyString(value.id, "id");
  assertNonEmptyString(value.title, "title");
  if (!CORE_CATEGORIES.includes(value.category)) {
    throw new TypeError("category must be an approved core category");
  }
  if (!CORE_DIFFICULTIES.includes(value.difficulty)) {
    throw new TypeError("difficulty must be an approved core difficulty");
  }
  return Object.freeze({ ...value });
}
