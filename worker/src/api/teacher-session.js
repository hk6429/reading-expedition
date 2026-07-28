import {
  createOpaqueToken,
  hashSecret,
  secretsEqual,
  verifyTeacherKey,
} from "../auth/teacher-auth.js";
import {
  clearSessionCookie,
  createSessionCookie,
  readSessionToken,
} from "../auth/session-cookie.js";
import { jsonResponse } from "./errors.js";

const SESSION_SECONDS = 8 * 60 * 60;
const UNAUTHORIZED_BODY = Object.freeze({
  error: {
    code: "unauthorized",
    message: "教師驗證失敗。",
  },
});

function unauthorizedResponse() {
  return jsonResponse(UNAUTHORIZED_BODY, {
    status: 401,
    headers: { "cache-control": "no-store" },
  });
}

export function createTeacherSessionApi({
  repository,
  teacherKeyHash,
  clock = () => new Date(),
}) {
  if (!repository || typeof repository.createTeacherSession !== "function") {
    throw new TypeError("teacher session repository is required");
  }

  async function authorize(request, { requireCsrf = false } = {}) {
    const token = readSessionToken(request);
    if (!token) return { ok: false };
    const tokenHash = await hashSecret(token);
    const session = await repository.getTeacherSession(tokenHash);
    if (
      !session ||
      session.revokedAt ||
      new Date(session.expiresAt).getTime() <= clock().getTime()
    ) {
      return { ok: false };
    }
    if (requireCsrf) {
      const csrfToken = request.headers.get("x-csrf-token");
      const csrfHash = await hashSecret(csrfToken);
      if (!csrfToken || !secretsEqual(csrfHash, session.csrfHash)) {
        return { ok: false };
      }
    }
    return { ok: true, sessionId: session.id, tokenHash };
  }

  return Object.freeze({
    async login(request) {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return unauthorizedResponse();
      }
      const key =
        payload &&
        Object.keys(payload).length === 1 &&
        typeof payload.key === "string"
          ? payload.key
          : "";
      if (!(await verifyTeacherKey(key, teacherKeyHash))) {
        return unauthorizedResponse();
      }

      const token = createOpaqueToken();
      const csrfToken = createOpaqueToken();
      const issuedAt = clock();
      const expiresAt = new Date(
        issuedAt.getTime() + SESSION_SECONDS * 1000,
      );
      await repository.createTeacherSession({
        id: crypto.randomUUID(),
        tokenHash: await hashSecret(token),
        csrfHash: await hashSecret(csrfToken),
        expiresAt: expiresAt.toISOString(),
        createdAt: issuedAt.toISOString(),
      });

      return jsonResponse(
        { csrfToken, expiresAt: expiresAt.toISOString() },
        {
          status: 201,
          headers: {
            "cache-control": "no-store",
            "set-cookie": createSessionCookie(token, SESSION_SECONDS),
          },
        },
      );
    },

    authorize,

    async logout(request) {
      const authorization = await authorize(request, { requireCsrf: true });
      if (!authorization.ok) return unauthorizedResponse();
      await repository.revokeTeacherSession(authorization.tokenHash);
      return new Response(null, {
        status: 204,
        headers: { "set-cookie": clearSessionCookie() },
      });
    },

    unauthorizedResponse,
  });
}
