export function gradeAssessment(answerKey, answers) {
  return {
    results: answerKey.map((item) => ({
      id: item.id,
      correct: answers[item.id] === item.correctAnswer,
      rationale: item.rationale,
      evidenceSpan: item.evidenceSpan,
      correctAnswer: item.correctAnswer,
    })),
  };
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
