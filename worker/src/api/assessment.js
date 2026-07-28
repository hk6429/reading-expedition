import { gradeAssessment } from "../../../src/domain/assessment-session.js";

export function assertAssessmentPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("payload must be an object");
  }
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== "answers,version") {
    throw new TypeError("payload must contain only version and answers");
  }
  if (!Number.isInteger(value.version) || value.version < 1) {
    throw new TypeError("version must be a positive integer");
  }
  if (
    !value.answers ||
    typeof value.answers !== "object" ||
    Array.isArray(value.answers)
  ) {
    throw new TypeError("answers must be an object");
  }
  for (const answer of Object.values(value.answers)) {
    if (typeof answer !== "string" || answer.length === 0 || answer.length > 300) {
      throw new TypeError("each answer must be a short non-empty string");
    }
  }
  return value;
}

export async function submitAssessment(repository, readingId, payload) {
  const answerKey = await repository.getAssessmentKey(
    readingId,
    payload.version,
  );
  if (!answerKey) return null;
  return gradeAssessment(answerKey, payload.answers);
}
