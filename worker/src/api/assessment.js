import {
  assessmentOutcome,
  gradeAssessment,
} from "../../../src/domain/assessment-session.js";

const encoder = new TextEncoder();
const PROOF_CATEGORIES = new Set(["world", "science", "humanities"]);
const PROOF_SKILLS = new Set(["comprehension", "inference", "evidence"]);
const PROOF_ID = /^[A-Za-z0-9_-]{1,160}$/;

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError("invalid base64url");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function assertedProofClaims(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("proof claims must be an object");
  }
  const keys = Object.keys(value).sort();
  if (
    keys.join(",") !==
    "category,contentKey,expiresAt,issuedAt,nonce,passed,readingId,skill,startedAt,v,version"
  ) {
    throw new TypeError("proof claims are invalid");
  }
  if (
    value.v !== 1 ||
    !PROOF_ID.test(value.readingId ?? "") ||
    !PROOF_ID.test(value.contentKey ?? "") ||
    !Number.isInteger(value.version) ||
    value.version < 1 ||
    !PROOF_CATEGORIES.has(value.category) ||
    !PROOF_SKILLS.has(value.skill) ||
    value.passed !== true ||
    !PROOF_ID.test(value.nonce ?? "") ||
    !Number.isFinite(Date.parse(value.startedAt)) ||
    !Number.isFinite(Date.parse(value.issuedAt)) ||
    !Number.isFinite(Date.parse(value.expiresAt))
  ) {
    throw new TypeError("proof claims are invalid");
  }
  return value;
}

function assertedStartClaims(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("assessment start claims must be an object");
  }
  const keys = Object.keys(value).sort();
  if (
    keys.join(",") !==
    "category,contentKey,expiresAt,issuedAt,kind,nonce,readingId,v,version"
  ) {
    throw new TypeError("assessment start claims are invalid");
  }
  if (
    value.v !== 1 ||
    value.kind !== "assessment_start" ||
    !PROOF_ID.test(value.readingId ?? "") ||
    !PROOF_ID.test(value.contentKey ?? "") ||
    !Number.isInteger(value.version) ||
    value.version < 1 ||
    !PROOF_CATEGORIES.has(value.category) ||
    !PROOF_ID.test(value.nonce ?? "") ||
    !Number.isFinite(Date.parse(value.issuedAt)) ||
    !Number.isFinite(Date.parse(value.expiresAt))
  ) {
    throw new TypeError("assessment start claims are invalid");
  }
  return value;
}

export class CompletionProofError extends Error {
  constructor(code) {
    super(code);
    this.name = "CompletionProofError";
    this.code = code;
  }
}

export function createCompletionProofService({
  secret,
  clock = () => new Date(),
  ttlMs = 10 * 60_000,
  startTtlMs = 2 * 60 * 60_000,
  minimumCompletionMs = 30_000,
}) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new TypeError("completion proof secret must be at least 32 characters");
  }
  if (!Number.isInteger(ttlMs) || ttlMs < 60_000 || ttlMs > 30 * 60_000) {
    throw new TypeError("completion proof ttl must be 1 to 30 minutes");
  }
  if (
    !Number.isInteger(startTtlMs) ||
    startTtlMs < 5 * 60_000 ||
    startTtlMs > 4 * 60 * 60_000
  ) {
    throw new TypeError("assessment start ttl must be 5 minutes to 4 hours");
  }
  if (
    !Number.isInteger(minimumCompletionMs) ||
    minimumCompletionMs < 0 ||
    minimumCompletionMs > 10 * 60_000
  ) {
    throw new TypeError("minimum completion time must be 0 to 10 minutes");
  }
  const keyPromise = crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  async function signClaims(claims) {
    const encodedClaims = bytesToBase64Url(
      encoder.encode(JSON.stringify(claims)),
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      await keyPromise,
      encoder.encode(encodedClaims),
    );
    return `${encodedClaims}.${bytesToBase64Url(new Uint8Array(signature))}`;
  }

  async function verifiedClaims(proof, assertion) {
    if (typeof proof !== "string" || proof.length > 2_048) {
      throw new TypeError("invalid proof");
    }
    const parts = proof.split(".");
    if (parts.length !== 2) throw new TypeError("invalid proof");
    const [encodedClaims, encodedSignature] = parts;
    const claimBytes = base64UrlToBytes(encodedClaims);
    const signatureBytes = base64UrlToBytes(encodedSignature);
    if (
      bytesToBase64Url(claimBytes) !== encodedClaims ||
      bytesToBase64Url(signatureBytes) !== encodedSignature
    ) {
      throw new TypeError("non-canonical base64url");
    }
    const valid = await crypto.subtle.verify(
      "HMAC",
      await keyPromise,
      signatureBytes,
      encoder.encode(encodedClaims),
    );
    if (!valid) throw new TypeError("invalid signature");
    return assertion(
      JSON.parse(new TextDecoder().decode(claimBytes)),
    );
  }

  async function issueStart({ readingId, contentKey, version, category }) {
    const now = clock();
    const claims = assertedStartClaims({
      v: 1,
      kind: "assessment_start",
      readingId,
      contentKey,
      version,
      category,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + startTtlMs).toISOString(),
      nonce: bytesToBase64Url(crypto.getRandomValues(new Uint8Array(18))),
    });
    return signClaims(claims);
  }

  async function verifyStart(proof) {
    try {
      const claims = await verifiedClaims(proof, assertedStartClaims);
      if (Date.parse(claims.expiresAt) <= clock().getTime()) {
        throw new CompletionProofError("assessment_session_expired");
      }
      return Object.freeze({ ...claims });
    } catch (error) {
      if (error instanceof CompletionProofError) throw error;
      throw new CompletionProofError("assessment_session_invalid");
    }
  }

  async function issue({
    readingId,
    contentKey,
    version,
    category,
    skill,
    startedAt,
  }) {
    const now = clock();
    const verifiedStartedAt =
      startedAt ?? new Date(now.getTime() - minimumCompletionMs).toISOString();
    if (
      !Number.isFinite(Date.parse(verifiedStartedAt)) ||
      now.getTime() - Date.parse(verifiedStartedAt) < minimumCompletionMs
    ) {
      throw new CompletionProofError("assessment_too_fast");
    }
    const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(18)));
    const claims = assertedProofClaims({
      v: 1,
      readingId,
      contentKey,
      version,
      category,
      skill,
      passed: true,
      startedAt: verifiedStartedAt,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      nonce,
    });
    return signClaims(claims);
  }

  async function verify(proof) {
    try {
      const claims = await verifiedClaims(proof, assertedProofClaims);
      if (Date.parse(claims.expiresAt) <= clock().getTime()) {
        throw new CompletionProofError("completion_proof_expired");
      }
      if (
        Date.parse(claims.issuedAt) - Date.parse(claims.startedAt) <
        minimumCompletionMs
      ) {
        throw new CompletionProofError("completion_proof_too_fast");
      }
      return Object.freeze({ ...claims });
    } catch (error) {
      if (error instanceof CompletionProofError) throw error;
      throw new CompletionProofError("completion_proof_invalid");
    }
  }

  return Object.freeze({ issueStart, verifyStart, issue, verify });
}

function provenSkill(answerKey, results) {
  const correctTypes = new Set(
    answerKey
      .filter((item) => results.find((result) => result.id === item.id)?.correct)
      .map((item) => item.type),
  );
  if (correctTypes.has("evidence")) return "evidence";
  if (correctTypes.has("inference")) return "inference";
  return "comprehension";
}

export function assertAssessmentPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("payload must be an object");
  }
  const keys = Object.keys(value).sort();
  if (
    ![
      "answers,version",
      "answers,assessmentSession,version",
    ].includes(keys.join(","))
  ) {
    throw new TypeError(
      "payload must contain version, answers, and an optional assessment session",
    );
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
  if (
    value.assessmentSession !== undefined &&
    (typeof value.assessmentSession !== "string" ||
      value.assessmentSession.length > 2_048 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.assessmentSession))
  ) {
    throw new TypeError("assessment session is invalid");
  }
  return value;
}

export function assertAssessmentSessionPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("payload must be an object");
  }
  if (
    Object.keys(value).join(",") !== "version" ||
    !Number.isInteger(value.version) ||
    value.version < 1
  ) {
    throw new TypeError("payload must contain only a positive version");
  }
  return value;
}

export async function submitAssessment(
  repository,
  readingId,
  payload,
  { completionProofService = null } = {},
) {
  const answerKey = await repository.getAssessmentKey(
    readingId,
    payload.version,
  );
  if (!answerKey) return null;
  const graded = gradeAssessment(answerKey, payload.answers);
  const outcome = assessmentOutcome(graded.results);
  let completionProof;
  if (
    outcome.passed &&
    payload.assessmentSession &&
    completionProofService &&
    typeof repository.getAssessmentProofContext === "function"
  ) {
    const context = await repository.getAssessmentProofContext(
      readingId,
      payload.version,
    );
    if (context) {
      const start = await completionProofService.verifyStart(
        payload.assessmentSession,
      );
      if (
        start.readingId !== context.readingId ||
        start.contentKey !== context.contentKey ||
        start.version !== context.version ||
        start.category !== context.category
      ) {
        throw new CompletionProofError("assessment_session_mismatch");
      }
      completionProof = await completionProofService.issue({
        ...context,
        skill: provenSkill(answerKey, graded.results),
        startedAt: start.issuedAt,
      });
      const proofClaims = await completionProofService.verify(completionProof);
      if (typeof repository.consumeAssessmentStartNonce !== "function") {
        throw new CompletionProofError("assessment_session_unavailable");
      }
      const consumed = await repository.consumeAssessmentStartNonce({
        nonce: start.nonce,
        readingId: start.readingId,
        contentKey: start.contentKey,
        version: start.version,
        category: start.category,
        consumedAt: proofClaims.issuedAt,
      });
      if (!consumed) {
        throw new CompletionProofError("assessment_session_replayed");
      }
    }
  }
  return {
    ...graded,
    ...outcome,
    ...(completionProof ? { completionProof } : {}),
  };
}
