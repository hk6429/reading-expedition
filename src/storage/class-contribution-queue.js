const QUEUE_KEY = "reading-expedition.class-contributions.v1";
const CATEGORIES = new Set(["world", "science", "humanities"]);
const SKILLS = new Set(["comprehension", "inference", "evidence"]);

function validate(item) {
  if (
    !item ||
    item.validReading !== true ||
    typeof item.contentId !== "string" ||
    !/^[A-Za-z0-9-]{1,120}$/.test(item.contentId) ||
    !CATEGORIES.has(item.category) ||
    !SKILLS.has(item.skill) ||
    !/^\d{4}-W\d{2}$/.test(item.period)
  ) {
    throw new TypeError("class contribution is invalid");
  }
  return structuredClone(item);
}

export function createClassContributionQueue(storage) {
  function load() {
    try {
      const parsed = JSON.parse(storage.getItem(QUEUE_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function save(items) {
    storage.setItem(QUEUE_KEY, JSON.stringify(items));
  }

  return Object.freeze({
    enqueue(item) {
      const valid = validate(item);
      const items = load();
      if (!items.some(({ contentId }) => contentId === valid.contentId)) {
        items.push(valid);
        save(items);
      }
    },
    list() {
      return load();
    },
    clear() {
      storage.removeItem(QUEUE_KEY);
    },
    async flush(send) {
      const remaining = [];
      for (const item of load()) {
        try {
          if (!(await send(structuredClone(item)))) remaining.push(item);
        } catch {
          remaining.push(item);
        }
      }
      save(remaining);
      return { remaining: remaining.length };
    },
  });
}
