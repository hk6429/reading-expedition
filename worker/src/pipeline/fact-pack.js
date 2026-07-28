import { crossCheckFacts, independentSourceCount } from "./cross-check.js";
import {
  requiresManualReview,
  sensitivityFlagsFor,
} from "./sensitivity.js";

const CATEGORIES = new Set(["world", "science", "humanities"]);
const REQUIRED_FACT_FIELDS = [
  "factKey",
  "claim",
  "sourceItemId",
  "sourceOriginId",
  "publishedAt",
  "confidence",
];

function assertFact(fact) {
  for (const field of REQUIRED_FACT_FIELDS) {
    if (fact[field] === undefined || fact[field] === null || fact[field] === "") {
      throw new TypeError(`fact ${field} is required`);
    }
  }
  if (
    !fact.location ||
    typeof fact.location.field !== "string" ||
    !Number.isInteger(fact.location.start) ||
    !Number.isInteger(fact.location.end)
  ) {
    throw new TypeError("fact location is required");
  }
  if (fact.confidence < 0 || fact.confidence > 1) {
    throw new TypeError("fact confidence must be between 0 and 1");
  }
}

export function buildFactPack({
  id,
  topicDate,
  category,
  topicKind,
  facts,
}) {
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(topicDate)) {
    throw new TypeError("fact pack id and topicDate are required");
  }
  if (!CATEGORIES.has(category)) {
    throw new TypeError("fact pack category is invalid");
  }
  if (!Array.isArray(facts) || facts.length === 0) {
    throw new TypeError("fact pack requires facts");
  }
  facts.forEach(assertFact);
  if (
    ["news", "controversial"].includes(topicKind) &&
    independentSourceCount(facts) < 2
  ) {
    throw new TypeError("news and controversial topics require two independent sources");
  }
  const crossCheck = crossCheckFacts(facts);
  const sensitivityFlags = sensitivityFlagsFor(
    facts.map(({ claim }) => claim).join("\n"),
  );
  return Object.freeze({
    id,
    topicDate,
    category,
    topicKind,
    facts: structuredClone(facts),
    sourceItemIds: [...new Set(facts.map(({ sourceItemId }) => sourceItemId))],
    sensitivityFlags,
    requiresManualReview: requiresManualReview(sensitivityFlags),
    verificationStatus: crossCheck.ok ? "verified" : "conflicted",
    conflicts: crossCheck.conflicts,
    version: 1,
  });
}
