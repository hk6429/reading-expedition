const CATEGORIES = ["world", "science", "humanities"];

function daysBetween(later, earlier) {
  return Math.floor(
    (new Date(`${later}T00:00:00Z`) - new Date(`${earlier}T00:00:00Z`)) /
      86_400_000,
  );
}

function eligible(candidate, date, fallback) {
  if (
    candidate.published ||
    candidate.score < 92 ||
    candidate.hardGateStatus === "failed"
  ) {
    return false;
  }
  if (!fallback) return true;
  const age = daysBetween(date, candidate.candidateDate);
  return age >= 0 && age <= 7;
}

export function selectDailyCandidates({ date, fresh, fallback }) {
  const result = [];
  for (const category of CATEGORIES) {
    const current = fresh
      .filter(
        (candidate) =>
          candidate.category === category && eligible(candidate, date, false),
      )
      .sort((left, right) => right.score - left.score)[0];
    if (current) {
      result.push(current);
      continue;
    }
    const backup = fallback
      .filter(
        (candidate) =>
          candidate.category === category && eligible(candidate, date, true),
      )
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.candidateDate.localeCompare(left.candidateDate),
      )[0];
    if (backup) result.push(backup);
  }
  return result;
}
