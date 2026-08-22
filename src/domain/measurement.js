const DAY_MS = 86_400_000;

function keyFor(event) {
  return `${event.context.deviceId}:${event.context.contentId}`;
}

function roundedRatio(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : 0;
}

export function computeLearningMetrics(events = []) {
  const devices = new Map();
  const completed = new Set();
  const evidence = new Set();
  let assessments = 0;
  let fastSubmits = 0;

  for (const item of events) {
    const timestamp = Date.parse(item.occurredAt);
    const id = item.context.deviceId;
    const history = devices.get(id) ?? [];
    history.push(timestamp);
    devices.set(id, history);
    if (item.type === "reading_completed") completed.add(keyFor(item));
    if (item.type === "evidence_located") evidence.add(keyFor(item));
    if (item.type === "assessment_submitted") {
      assessments += 1;
      if (item.context.durationBucket === "under-1m") fastSubmits += 1;
    }
  }

  const cohortSize = devices.size;
  const retained = (days) =>
    [...devices.values()].filter((times) => {
      const first = Math.min(...times);
      return times.some(
        (time) => Math.floor((time - first) / DAY_MS) === days,
      );
    }).length;
  const returned = [...devices.values()].filter((times) => times.length > 1).length;
  const validReadings = [...completed].filter((key) => evidence.has(key)).length;

  return Object.freeze({
    validReadings,
    completionRate: roundedRatio(validReadings, completed.size),
    d1Retention: roundedRatio(retained(1), cohortSize),
    d7Retention: roundedRatio(retained(7), cohortSize),
    d30Retention: roundedRatio(retained(30), cohortSize),
    evidenceConsistency: roundedRatio(
      [...evidence].filter((key) => completed.has(key)).length,
      assessments,
    ),
    returnRate: roundedRatio(returned, cohortSize),
    fastSubmitRate: roundedRatio(fastSubmits, assessments),
  });
}

export function evaluateExperiment(
  baseline,
  candidate,
  sideEffects,
  protocol = null,
) {
  const reasons = [];
  const inconclusiveReasons = [];
  if (
    !protocol?.hypothesis ||
    !protocol?.primaryMetric ||
    !Number.isInteger(protocol?.minimumSamplePerVariant) ||
    !Number.isInteger(protocol?.minimumDays)
  ) {
    reasons.push("preregistration_missing");
  } else {
    if (
      protocol.baselineSample < protocol.minimumSamplePerVariant ||
      protocol.candidateSample < protocol.minimumSamplePerVariant
    ) {
      inconclusiveReasons.push("sample_too_small");
    }
    if (protocol.observedDays < protocol.minimumDays) {
      inconclusiveReasons.push("observation_too_short");
    }
  }
  if (candidate.completionRate <= baseline.completionRate) {
    reasons.push("completion_not_improved");
  }
  if (candidate.evidenceConsistency < baseline.evidenceConsistency) {
    reasons.push("evidence_regressed");
  }
  if (sideEffects.fastSubmitRate > 0.15) reasons.push("fast_submit_risk");
  if (sideEffects.fixedOptionRate > 0.35) reasons.push("fixed_option_risk");
  if (
    Number.isFinite(sideEffects.baselineKeyboardCompletionRate) &&
    sideEffects.keyboardCompletionRate <
      sideEffects.baselineKeyboardCompletionRate
  ) {
    reasons.push("keyboard_access_regressed");
  }
  if (
    Number.isFinite(sideEffects.baselineOfflineFailureRate) &&
    sideEffects.offlineFailureRate > sideEffects.baselineOfflineFailureRate
  ) {
    reasons.push("offline_failure_regressed");
  }
  if (
    Number.isFinite(sideEffects.baselineRecoveryRate) &&
    sideEffects.recoveryRate < sideEffects.baselineRecoveryRate
  ) {
    reasons.push("recovery_regressed");
  }
  const allReasons = [...inconclusiveReasons, ...reasons];
  const status = inconclusiveReasons.length
    ? "inconclusive"
    : reasons.length
      ? "rejected"
      : "accepted";
  return Object.freeze({
    success: status === "accepted",
    status,
    reasons: Object.freeze(allReasons),
  });
}
