import {
  createOpaqueToken,
  hashSecret,
  secretsEqual,
} from "../auth/teacher-auth.js";
import {
  clearFamilySessionCookie,
  createFamilySessionCookie,
  readFamilySessionToken,
} from "../auth/family-session.js";
import { errorResponse, jsonResponse } from "./errors.js";
import { assertLearningState } from "../../../src/storage/state-validator.js";

const SESSION_SECONDS = 30 * 24 * 60 * 60;
const PASSPORT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createPassportCode() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const compact = [...bytes]
    .map((byte) => PASSPORT_ALPHABET[byte % PASSPORT_ALPHABET.length])
    .join("");
  return compact.match(/.{4}/g).join("-");
}

function normalizePassportCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "");
}

function validTimeZone(value) {
  if (typeof value !== "string" || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function validAlias(value) {
  const alias = String(value ?? "").trim();
  return alias.length >= 1 && alias.length <= 12 && !alias.includes("@");
}

function validLearningState(state) {
  try {
    assertLearningState(state);
    return true;
  } catch {
    return false;
  }
}

function unauthorized() {
  return errorResponse(
    "unauthorized",
    "家庭護照驗證失敗。",
    401,
  );
}

function invalid(message = "家庭護照資料格式不正確。") {
  return errorResponse("invalid_family_payload", message, 400);
}

export function createFamilyPassportApi({
  repository,
  clock = () => new Date(),
}) {
  const required = [
    "createFamilyPassport",
    "findFamilyByCodeHash",
    "getFamilyPassport",
    "createFamilySession",
    "getFamilySession",
    "revokeFamilySession",
    "listFamilyChildren",
    "createFamilyChild",
    "getFamilyChildState",
    "updateFamilyChildState",
    "deleteFamilyChild",
    "revokeFamily",
  ];
  if (
    !repository ||
    required.some((method) => typeof repository[method] !== "function")
  ) {
    throw new TypeError("family passport repository is required");
  }

  async function issueSession(family) {
    const token = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const issuedAt = clock();
    const expiresAt = new Date(
      issuedAt.getTime() + SESSION_SECONDS * 1000,
    );
    await repository.createFamilySession({
      id: crypto.randomUUID(),
      familyId: family.id,
      tokenHash: await hashSecret(token),
      csrfHash: await hashSecret(csrfToken),
      expiresAt: expiresAt.toISOString(),
      createdAt: issuedAt.toISOString(),
    });
    return {
      csrfToken,
      expiresAt: expiresAt.toISOString(),
      cookie: createFamilySessionCookie(token, SESSION_SECONDS),
    };
  }

  async function authorize(request, { requireCsrf = false } = {}) {
    const token = readFamilySessionToken(request);
    if (!token) return { ok: false };
    const tokenHash = await hashSecret(token);
    const session = await repository.getFamilySession(tokenHash);
    if (
      !session ||
      session.revokedAt ||
      new Date(session.expiresAt).getTime() <= clock().getTime()
    ) {
      return { ok: false };
    }
    if (requireCsrf) {
      const csrfToken = request.headers.get("x-csrf-token");
      if (!csrfToken) return { ok: false };
      const csrfHash = await hashSecret(csrfToken);
      if (!secretsEqual(csrfHash, session.csrfHash)) return { ok: false };
    }
    return {
      ok: true,
      familyId: session.familyId,
      tokenHash,
      sessionId: session.id,
    };
  }

  return Object.freeze({
    async create(request) {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return invalid();
      }
      if (
        !payload ||
        Object.keys(payload).sort().join(",") !== "timeZone" ||
        !validTimeZone(payload.timeZone)
      ) {
        return invalid("請提供有效的家庭所在地時區。");
      }
      const passportCode = createPassportCode();
      const family = {
        id: crypto.randomUUID(),
        codeHash: await hashSecret(normalizePassportCode(passportCode)),
        timeZone: payload.timeZone,
        createdAt: clock().toISOString(),
      };
      await repository.createFamilyPassport(family);
      const session = await issueSession(family);
      return jsonResponse(
        {
          passportCode,
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt,
          family: {
            id: family.id,
            timeZone: family.timeZone,
            children: [],
          },
        },
        {
          status: 201,
          headers: {
            "cache-control": "no-store",
            "set-cookie": session.cookie,
          },
        },
      );
    },

    async login(request) {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return unauthorized();
      }
      const code =
        payload &&
        Object.keys(payload).length === 1 &&
        typeof payload.passportCode === "string"
          ? normalizePassportCode(payload.passportCode)
          : "";
      if (code.length !== 16) return unauthorized();
      const family = await repository.findFamilyByCodeHash(
        await hashSecret(code),
      );
      if (!family || family.revokedAt) return unauthorized();
      const session = await issueSession(family);
      const children = await repository.listFamilyChildren(family.id);
      return jsonResponse(
        {
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt,
          family: {
            id: family.id,
            timeZone: family.timeZone,
            children,
          },
        },
        {
          status: 201,
          headers: {
            "cache-control": "no-store",
            "set-cookie": session.cookie,
          },
        },
      );
    },

    authorize,

    async current(familyId) {
      const family = await repository.getFamilyPassport(familyId);
      if (!family || family.revokedAt) return unauthorized();
      const children = await repository.listFamilyChildren(familyId);
      return jsonResponse(
        {
          family: {
            id: familyId,
            timeZone: family.timeZone,
            children,
          },
        },
        { headers: { "cache-control": "no-store" } },
      );
    },

    async createChild(request, familyId) {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return invalid();
      }
      if (
        !payload ||
        Object.keys(payload).sort().join(",") !== "alias,state" ||
        !validAlias(payload.alias) ||
        !validLearningState(payload.state)
      ) {
        return invalid(
          "請使用 1–12 字的孩子代號，並確認紀錄不含姓名、Email、答案或自由文字。",
        );
      }
      const record = {
        id: crypto.randomUUID(),
        familyId,
        alias: payload.alias.trim(),
        state: payload.state,
        createdAt: clock().toISOString(),
      };
      await repository.createFamilyChild(record);
      return jsonResponse(
        {
          child: {
            id: record.id,
            alias: record.alias,
            stateVersion: 1,
          },
        },
        { status: 201, headers: { "cache-control": "no-store" } },
      );
    },

    async childState(familyId, childId) {
      const record = await repository.getFamilyChildState(
        familyId,
        childId,
      );
      if (!record) {
        return errorResponse("not_found", "找不到這位孩子的紀錄。", 404);
      }
      return jsonResponse(record, {
        headers: { "cache-control": "no-store" },
      });
    },

    async updateChildState(request, familyId, childId) {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return invalid();
      }
      if (
        !payload ||
        Object.keys(payload).sort().join(",") !== "expectedVersion,state" ||
        !Number.isInteger(payload.expectedVersion) ||
        !validLearningState(payload.state)
      ) {
        return invalid();
      }
      const updated = await repository.updateFamilyChildState(
        familyId,
        childId,
        payload.state,
        payload.expectedVersion,
      );
      if (!updated) {
        return errorResponse(
          "version_conflict",
          "另一部裝置已更新紀錄，請重新載入後再試。",
          409,
        );
      }
      return jsonResponse(updated, {
        headers: { "cache-control": "no-store" },
      });
    },

    async deleteChild(familyId, childId) {
      const deleted = await repository.deleteFamilyChild(
        familyId,
        childId,
      );
      if (!deleted) {
        return errorResponse("not_found", "找不到這位孩子。", 404);
      }
      return new Response(null, { status: 204 });
    },

    async logout(request) {
      const authorization = await authorize(request, { requireCsrf: true });
      if (!authorization.ok) return unauthorized();
      await repository.revokeFamilySession(authorization.tokenHash);
      return new Response(null, {
        status: 204,
        headers: { "set-cookie": clearFamilySessionCookie() },
      });
    },

    async deleteFamily(familyId) {
      await repository.revokeFamily(familyId);
      return new Response(null, {
        status: 204,
        headers: { "set-cookie": clearFamilySessionCookie() },
      });
    },

    unauthorizedResponse: unauthorized,
  });
}
