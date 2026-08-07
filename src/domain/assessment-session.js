export function gradeAssessment(answerKey, answers) {
  return {
    results: answerKey.map((item) => {
      const selectedAnswer = answers[item.id];
      const correct = selectedAnswer === item.correctAnswer;
      return correct
        ? {
            id: item.id,
            correct,
            rationale: item.rationale,
            evidenceSpan: item.evidenceSpan,
          }
        : {
            id: item.id,
            correct,
            diagnostic:
              item.distractorReasons?.[selectedAnswer] ??
              "這個選項和原文線索還有落差，請回到標示段落再比對一次。",
            evidenceSpan: item.evidenceSpan,
          };
    }),
  };
}

export function assessmentOutcome(results = []) {
  const total = results.length;
  const correctCount = results.filter(({ correct }) => correct).length;
  const requiredCorrectCount = Math.max(1, Math.ceil((total * 2) / 3));
  return Object.freeze({
    total,
    correctCount,
    requiredCorrectCount,
    passed: total > 0 && correctCount >= requiredCorrectCount,
  });
}

export function createAssessmentSession({ itemIds, submit }) {
  const answers = {};
  let attempts = 0;

  return Object.freeze({
    answer(itemId, value) {
      if (attempts >= 2) throw new Error("assessment is already final");
      if (!itemIds.includes(itemId)) throw new TypeError("unknown item");
      if (typeof value !== "string" || value.length === 0) {
        throw new TypeError("answer must be a non-empty string");
      }
      answers[itemId] = value;
    },
    async submit() {
      if (attempts >= 2) throw new Error("assessment is already final");
      if (itemIds.some((itemId) => !answers[itemId])) {
        throw new Error("all items must be answered");
      }
      attempts += 1;
      const result = await submit({ ...answers });
      return {
        ...result,
        attempt: attempts,
        canRevise: attempts === 1,
      };
    },
    snapshot() {
      return { answers: { ...answers }, attempts };
    },
  });
}
