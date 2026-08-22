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
const EVENT_KEYS = Object.freeze(["id", "type", "occurredAt", "context"]);
const EVENT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set(["world", "science", "humanities"]);
const DIFFICULTIES = new Set(["guided", "challenge"]);
const DURATION_BUCKETS = new Set(["under-1m", "1-5m", "6-10m", "over-10m"]);

function exactKeys(value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`${key} is not allowed`);
  }
}

function assertEvent(event, { nowMs, pastWindowMs, futureWindowMs }) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError("event must be an object");
  }
  exactKeys(event, EVENT_KEYS);
  if (typeof event.id !== "string" || !EVENT_ID.test(event.id)) {
    throw new TypeError("invalid event id");
  }
  if (!EVENT_TYPES.includes(event.type)) throw new TypeError("invalid event type");
  const occurredAtMs = Date.parse(event.occurredAt);
  if (!Number.isFinite(occurredAtMs)) {
    throw new TypeError("invalid occurredAt");
  }
  if (
    occurredAtMs < nowMs - pastWindowMs ||
    occurredAtMs > nowMs + futureWindowMs
  ) {
    throw new TypeError("occurredAt is outside the accepted window");
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
    id: event.id,
    type: event.type,
    occurredAt: new Date(event.occurredAt).toISOString(),
    context: Object.freeze({ ...event.context }),
  });
}

export function assertEventBatch(
  payload,
  {
    now = new Date(),
    pastWindowMs = 45 * 86_400_000,
    futureWindowMs = 5 * 60_000,
  } = {},
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("payload must be an object");
  }
  exactKeys(payload, ["events"]);
  if (!Array.isArray(payload.events) || payload.events.length < 1) {
    throw new TypeError("events must be a non-empty array");
  }
  if (payload.events.length > 50) throw new TypeError("event batch is too large");
  const nowMs = now.getTime();
  if (
    !Number.isFinite(nowMs) ||
    !Number.isInteger(pastWindowMs) ||
    pastWindowMs < 0 ||
    !Number.isInteger(futureWindowMs) ||
    futureWindowMs < 0
  ) {
    throw new TypeError("invalid event time window");
  }
  return Object.freeze(
    payload.events.map((event) =>
      assertEvent(event, { nowMs, pastWindowMs, futureWindowMs }),
    ),
  );
}
