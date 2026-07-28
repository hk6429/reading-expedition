function normalize(text) {
  return String(text)
    .normalize("NFKC")
    .toLocaleLowerCase("zh-Hant-TW")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function ngrams(text, size = 3) {
  const normalized = normalize(text);
  const result = new Set();
  for (let index = 0; index <= normalized.length - size; index += 1) {
    result.add(normalized.slice(index, index + size));
  }
  return result;
}

export function contentSimilarity(left, right) {
  const leftSet = ngrams(left);
  const rightSet = ngrams(right);
  if (leftSet.size === 0 && rightSet.size === 0) return 1;
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

export function isTooSimilar(left, right, threshold = 0.78) {
  return contentSimilarity(left, right) >= threshold;
}
