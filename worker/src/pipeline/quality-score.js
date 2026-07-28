export const QUALITY_WEIGHTS = Object.freeze({
  sources: 20,
  facts: 25,
  originality: 15,
  readingLevel: 15,
  assessment: 20,
  safety: 5,
});

export function calculateQualityScore(scores) {
  const breakdown = {};
  let rawTotal = 0;
  for (const [dimension, weight] of Object.entries(QUALITY_WEIGHTS)) {
    const value = scores[dimension];
    if (typeof value !== "number" || value < 0 || value > 1) {
      throw new TypeError(`quality dimension ${dimension} must be between 0 and 1`);
    }
    breakdown[dimension] = Math.round(value * weight * 100) / 100;
    rawTotal += breakdown[dimension];
  }
  const total = Math.round(rawTotal);
  return Object.freeze({
    breakdown,
    total,
    requiresManualReview: total < 92,
  });
}
