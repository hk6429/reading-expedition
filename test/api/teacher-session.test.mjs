import assert from "node:assert/strict";
import test from "node:test";

import { createTeacherSessionApi } from "../../worker/src/api/teacher-session.js";
import { createApi } from "../../worker/src/api/router.js";
import { hashSecret } from "../../worker/src/auth/teacher-auth.js";

function createSessionRepository() {
  const sessions = new Map();
  return {
    sessions,
    async createTeacherSession(session) {
      sessions.set(session.tokenHash, { ...session, revokedAt: null });
    },
    async getTeacherSession(tokenHash) {
      return sessions.get(tokenHash) ?? null;
    },
    async revokeTeacherSession(tokenHash) {
      const session = sessions.get(tokenHash);
      if (session) session.revokedAt = new Date().toISOString();
    },
  };
}

test("教師登入建立安全 cookie，原始 token 不寫入資料庫", async () => {
  const repository = createSessionRepository();
  const api = createTeacherSessionApi({
    repository,
    teacherKeyHash: await hashSecret("teacher-secret"),
    clock: () => new Date("2026-07-28T00:00:00.000Z"),
  });

  const response = await api.login(
    new Request("https://example.test/api/v1/teacher/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "teacher-secret" }),
    }),
  );
  const payload = await response.json();
  const cookie = response.headers.get("set-cookie");

  assert.equal(response.status, 201);
  assert.match(cookie, /teacher_session=[A-Za-z0-9_-]{43}/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  assert.equal(typeof payload.csrfToken, "string");
  assert.equal(repository.sessions.has(cookie.match(/teacher_session=([^;]+)/)[1]), false);
});

test("登入失敗不透露密鑰設定狀態", async () => {
  const request = () =>
    new Request("https://example.test/api/v1/teacher/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "wrong" }),
    });
  const configured = createTeacherSessionApi({
    repository: createSessionRepository(),
    teacherKeyHash: await hashSecret("teacher-secret"),
  });
  const unconfigured = createTeacherSessionApi({
    repository: createSessionRepository(),
    teacherKeyHash: "",
  });

  const configuredResponse = await configured.login(request());
  const unconfiguredResponse = await unconfigured.login(request());

  assert.equal(configuredResponse.status, 401);
  assert.equal(unconfiguredResponse.status, 401);
  assert.deepEqual(
    await configuredResponse.json(),
    await unconfiguredResponse.json(),
  );
});

test("教師 session 會檢查到期、撤銷與 CSRF token", async () => {
  const repository = createSessionRepository();
  const clock = () => new Date("2026-07-28T00:00:00.000Z");
  const api = createTeacherSessionApi({
    repository,
    teacherKeyHash: await hashSecret("teacher-secret"),
    clock,
  });
  const loginResponse = await api.login(
    new Request("https://example.test/api/v1/teacher/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "teacher-secret" }),
    }),
  );
  const { csrfToken } = await loginResponse.json();
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];

  const authorized = await api.authorize(
    new Request("https://example.test/api/v1/teacher/review", {
      method: "POST",
      headers: { cookie, "x-csrf-token": csrfToken },
    }),
    { requireCsrf: true },
  );
  const missingCsrf = await api.authorize(
    new Request("https://example.test/api/v1/teacher/review", {
      method: "POST",
      headers: { cookie },
    }),
    { requireCsrf: true },
  );

  assert.equal(authorized.ok, true);
  assert.equal(missingCsrf.ok, false);

  await repository.revokeTeacherSession(authorized.tokenHash);
  const revoked = await api.authorize(
    new Request("https://example.test/api/v1/teacher/review", {
      headers: { cookie },
    }),
  );
  assert.equal(revoked.ok, false);
});

test("前端身份文字或自訂 header 無法取得教師草稿權限", async () => {
  const repository = createSessionRepository();
  const teacherSessionApi = createTeacherSessionApi({
    repository,
    teacherKeyHash: await hashSecret("teacher-secret"),
  });
  const api = createApi({
    repository: {
      ...repository,
      getPublishedDaily: async () => [],
    },
    teacherSessionApi,
  });

  const response = await api.fetch(
    new Request("https://example.test/api/v1/teacher/review", {
      headers: {
        "x-role": "teacher",
        "x-identity-view": "teacher",
      },
    }),
  );

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "unauthorized");
});
