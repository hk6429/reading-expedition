function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function normalizeTitle(value) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("zh-Hant-TW")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function deduplicateCandidates(candidates) {
  const urls = new Set();
  const titles = new Set();
  const factFingerprints = new Set();
  const unique = [];
  const duplicates = [];

  for (const candidate of candidates) {
    const url = normalizeUrl(candidate.canonicalUrl);
    const title = normalizeTitle(candidate.title);
    const factFingerprint = candidate.factFingerprint;
    const reasons = [];
    if (urls.has(url)) reasons.push("canonical_url");
    if (titles.has(title)) reasons.push("title");
    if (factFingerprints.has(factFingerprint)) reasons.push("fact_fingerprint");
    if (reasons.length > 0) {
      duplicates.push({ ...candidate, duplicateReasons: reasons });
      continue;
    }
    urls.add(url);
    titles.add(title);
    factFingerprints.add(factFingerprint);
    unique.push(candidate);
  }
  return { unique, duplicates };
}
