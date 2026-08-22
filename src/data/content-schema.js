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
  assertPlainText(value, field);
}

const HTML_MARKUP = /<\s*\/?\s*[a-z][^>]*>|<!--|<!doctype\b/i;

export function assertPlainText(value, field = "content") {
  if (typeof value === "string") {
    if (HTML_MARKUP.test(value)) {
      throw new TypeError(`${field} must not contain HTML markup`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainText(item, `${field}[${index}]`));
    return value;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assertPlainText(item, `${field}.${key}`);
    }
  }
  return value;
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
