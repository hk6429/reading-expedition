export { sensitivityFlagsFor } from "./sensitivity.js";

const ENTITY_FIELDS = ["numbers", "dates", "people", "units"];

function normalizedValues(values) {
  return [...new Set((values ?? []).map((value) => String(value).trim()))].sort();
}

export function crossCheckFacts(facts) {
  const groups = new Map();
  for (const fact of facts) {
    const group = groups.get(fact.factKey) ?? [];
    group.push(fact);
    groups.set(fact.factKey, group);
  }
  const conflicts = [];
  for (const [factKey, group] of groups) {
    if (group.length < 2) continue;
    for (const field of ENTITY_FIELDS) {
      const variants = new Map();
      for (const fact of group) {
        const values = normalizedValues(fact.entities?.[field]);
        if (values.length === 0) continue;
        const key = JSON.stringify(values);
        const sources = variants.get(key) ?? [];
        sources.push(fact.sourceItemId);
        variants.set(key, sources);
      }
      if (variants.size > 1) {
        conflicts.push({
          factKey,
          field,
          variants: [...variants.entries()].map(([value, sourceItemIds]) => ({
            value: JSON.parse(value),
            sourceItemIds,
          })),
        });
      }
    }
  }
  return { ok: conflicts.length === 0, conflicts };
}

export function independentSourceCount(facts) {
  return new Set(facts.map(({ sourceOriginId }) => sourceOriginId).filter(Boolean))
    .size;
}
