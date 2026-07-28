export function validateAssessmentAnswers(reading, items) {
  const errors = new Set();
  for (const item of items) {
    const answerCount = item.options?.filter(
      (option) => option === item.correctAnswer,
    ).length;
    if (
      !Array.isArray(item.options) ||
      new Set(item.options).size !== item.options.length ||
      answerCount !== 1
    ) {
      errors.add("multiple_correct_answers");
    }
    const distractors = (item.options ?? []).filter(
      (option) => option !== item.correctAnswer,
    );
    if (
      !distractors.every(
        (option) => typeof item.distractorReasons?.[option] === "string",
      )
    ) {
      errors.add("missing_distractor_reason");
    }
    const span = item.evidenceSpan;
    const rawParagraph = reading.body?.[span?.paragraph - 1];
    const paragraph =
      typeof rawParagraph === "string" ? rawParagraph : rawParagraph?.text;
    if (
      typeof paragraph !== "string" ||
      !Number.isInteger(span?.start) ||
      !Number.isInteger(span?.end) ||
      typeof span?.text !== "string" ||
      span.text.length < 8 ||
      span.text.length > 30 ||
      paragraph.slice(span.start, span.end) !== span.text
    ) {
      errors.add("evidence_not_found");
    }
  }
  return { ok: errors.size === 0, errors: [...errors] };
}
