export const EVENT_TYPES = Object.freeze([
  "reading_opened",
  "reading_completed",
  "assessment_submitted",
  "evidence_located",
  "answer_revised",
  "city_invested",
  "return_visit",
  "chapter_reviewed",
]);

const CONTEXT_KEYS = Object.freeze([
  "contentId",
  "category",
  "difficulty",
  "durationBucket",
  "deviceId",
]);
const EVENT_KEYS = Object.freeze(["type", "occurredAt", "context"]);
const CATEGORIES = new Set(["world", "science", "humanities"]);
const DIFFICULTIES = new Set(["guided", "challenge"]);
const DURATION_BUCKETS = new Set(["under-1m", "1-5m", "6-10m", "over-10m"]);

function exactKeys(value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`${key} is not allowed`);
  }
}

function assertEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError("event must be an object");
  }
  exactKeys(event, EVENT_KEYS);
  if (!EVENT_TYPES.includes(event.type)) throw new TypeError("invalid event type");
  if (!Number.isFinite(Date.parse(event.occurredAt))) {
    throw new TypeError("invalid occurredAt");
  }
  if (!event.context || typeof event.context !== "object") {
    throw new TypeError("event context is required");
  }
  exactKeys(event.context, CONTEXT_KEYS);
  const { contentId, category, difficulty, durationBucket, deviceId } =
    event.context;
  if (typeof contentId !== "string" || !/^[a-zA-Z0-9-]{1,120}$/.test(contentId)) {
    throw new TypeError("invalid contentId");
  }
  if (!CATEGORIES.has(category)) throw new TypeError("invalid category");
  if (!DIFFICULTIES.has(difficulty)) throw new TypeError("invalid difficulty");
  if (!DURATION_BUCKETS.has(durationBucket)) {
    throw new TypeError("invalid durationBucket");
  }
  if (typeof deviceId !== "string" || !/^[a-zA-Z0-9-]{8,120}$/.test(deviceId)) {
    throw new TypeError("invalid anonymous deviceId");
  }
  return Object.freeze({
    type: event.type,
    occurredAt: new Date(event.occurredAt).toISOString(),
    context: Object.freeze({ ...event.context }),
  });
}

export function assertEventBatch(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("payload must be an object");
  }
  exactKeys(payload, ["events"]);
  if (!Array.isArray(payload.events) || payload.events.length < 1) {
    throw new TypeError("events must be a non-empty array");
  }
  if (payload.events.length > 50) throw new TypeError("event batch is too large");
  return Object.freeze(payload.events.map(assertEvent));
}
