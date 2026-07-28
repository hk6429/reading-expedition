const QUEUE_KEY = "reading-expedition.sync-queue.v1";
const EVENT_KEYS = new Set(["id", "type", "createdAt", "context"]);
const CONTEXT_KEYS = new Set([
  "contentId",
  "category",
  "difficulty",
  "durationBucket",
  "deviceId",
]);

function assertAllowedKeys(value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${key} is not allowed`);
  }
}

function validate(event) {
  if (!event || typeof event !== "object") {
    throw new TypeError("event is required");
  }
  assertAllowedKeys(event, EVENT_KEYS);
  assertAllowedKeys(event.context ?? {}, CONTEXT_KEYS);
  if (
    typeof event.id !== "string" ||
    typeof event.type !== "string" ||
    typeof event.createdAt !== "string"
  ) {
    throw new TypeError("event identity is invalid");
  }
  return structuredClone(event);
}

export function createSyncQueue(storage) {
  function load() {
    try {
      const value = JSON.parse(storage.getItem(QUEUE_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
  function save(events) {
    storage.setItem(QUEUE_KEY, JSON.stringify(events));
  }

  return Object.freeze({
    enqueue(event) {
      const valid = validate(event);
      const events = load();
      if (!events.some(({ id }) => id === valid.id)) events.push(valid);
      save(events);
    },
    list() {
      return load();
    },
    clear() {
      save([]);
    },
    async flush(send) {
      const remaining = [];
      for (const event of load()) {
        try {
          if (!(await send(structuredClone(event)))) remaining.push(event);
        } catch {
          remaining.push(event);
        }
      }
      save(remaining);
      return { remaining: remaining.length };
    },
  });
}
