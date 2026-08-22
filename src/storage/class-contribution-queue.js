const QUEUE_KEY = "reading-expedition.class-contributions.v1";
import { createClassContribution } from "../domain/class-contribution.js";

const QUALITY_KEYS = new Set([
  "firstCorrect",
  "revisedCorrect",
  "revisionOpportunities",
  "abilityResults",
  "evidenceViewed",
  "transferCompleted",
]);

function validateQuality(value, { partial = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("class contribution quality is invalid");
  }
  for (const key of Object.keys(value)) {
    if (!QUALITY_KEYS.has(key)) {
      throw new TypeError("class contribution quality is invalid");
    }
  }
  if (
    (!partial || "firstCorrect" in value) &&
    (!Number.isInteger(value.firstCorrect) ||
      value.firstCorrect < 0 ||
      value.firstCorrect > 3)
  ) {
    throw new TypeError("class contribution quality is invalid");
  }
  if (
    "revisionOpportunities" in value &&
    (!Number.isInteger(value.revisionOpportunities) ||
      value.revisionOpportunities < 0 ||
      value.revisionOpportunities > 3)
  ) {
    throw new TypeError("class contribution quality is invalid");
  }
  if ("abilityResults" in value) {
    const results = value.abilityResults;
    if (
      !results ||
      typeof results !== "object" ||
      Array.isArray(results) ||
      Object.keys(results).sort().join(",") !==
        "comprehension,evidence,inference" ||
      Object.values(results).some(
        (result) =>
          !result ||
          Object.keys(result).sort().join(",") !==
            "firstCorrect,opportunities" ||
          !Number.isInteger(result.opportunities) ||
          result.opportunities < 0 ||
          result.opportunities > 3 ||
          !Number.isInteger(result.firstCorrect) ||
          result.firstCorrect < 0 ||
          result.firstCorrect > result.opportunities,
      )
    ) {
      throw new TypeError("class contribution quality is invalid");
    }
  }
  if (
    (!partial || "revisedCorrect" in value) &&
    (!Number.isInteger(value.revisedCorrect) ||
      value.revisedCorrect < 0 ||
      value.revisedCorrect > 3)
  ) {
    throw new TypeError("class contribution quality is invalid");
  }
  for (const key of ["evidenceViewed", "transferCompleted"]) {
    if ((!partial || key in value) && typeof value[key] !== "boolean") {
      throw new TypeError("class contribution quality is invalid");
    }
  }
  return Object.freeze({ ...value });
}

function validate(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new TypeError("class contribution is invalid");
  }
  const { quality, ...base } = item;
  const contribution = createClassContribution(base);
  return structuredClone({
    ...contribution,
    ...(quality === undefined ? {} : { quality: validateQuality(quality) }),
  });
}

export function createClassContributionQueue(storage) {
  function load() {
    try {
      const parsed = JSON.parse(storage.getItem(QUEUE_KEY) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((item) => {
        try {
          return [validate(item)];
        } catch {
          return [];
        }
      });
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
      if (!items.some(({ contentKey }) => contentKey === valid.contentKey)) {
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
    updateQuality(contentKey, changes) {
      const validChanges = validateQuality(changes, { partial: true });
      const items = load();
      const index = items.findIndex((item) => item.contentKey === contentKey);
      if (index < 0) return false;
      items[index] = validate({
        ...items[index],
        quality: {
          firstCorrect: 0,
          revisedCorrect: 0,
          revisionOpportunities: 0,
          abilityResults: {
            comprehension: { opportunities: 0, firstCorrect: 0 },
            inference: { opportunities: 0, firstCorrect: 0 },
            evidence: { opportunities: 0, firstCorrect: 0 },
          },
          evidenceViewed: false,
          transferCompleted: false,
          ...items[index].quality,
          ...validChanges,
        },
      });
      save(items);
      return true;
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
