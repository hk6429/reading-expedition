import assert from "node:assert/strict";
import test from "node:test";

import { createFamilyPassportApi } from "../../worker/src/api/family-passport.js";
import { createApi } from "../../worker/src/api/router.js";
import { createDefaultState } from "../../src/storage/local-store.js";

function createRepository() {
  const families = new Map();
  const sessions = new Map();
  const children = new Map();
  const states = new Map();
  return {
    families,
    sessions,
    children,
    states,
    async createFamilyPassport(record) {
      families.set(record.id, { ...record, revokedAt: null });
    },
    async findFamilyByCodeHash(codeHash) {
      return [...families.values()].find(
        (family) => family.codeHash === codeHash,
      ) ?? null;
    },
    async getFamilyPassport(familyId) {
      return families.get(familyId) ?? null;
    },
    async createFamilySession(record) {
      sessions.set(record.tokenHash, { ...record, revokedAt: null });
    },
    async getFamilySession(tokenHash) {
      return sessions.get(tokenHash) ?? null;
    },
    async revokeFamilySession(tokenHash) {
      const session = sessions.get(tokenHash);
      if (session) session.revokedAt = "2026-07-30T01:00:00.000Z";
    },
    async listFamilyChildren(familyId) {
      return [...children.values()].filter(
        (child) => child.familyId === familyId,
      );
    },
    async createFamilyChild(record) {
      children.set(record.id, record);
      states.set(record.id, {
        childId: record.id,
        state: record.state,
        version: 1,
        updatedAt: record.createdAt,
      });
    },
    async getFamilyChildState(familyId, childId) {
      const child = children.get(childId);
      return child?.familyId === familyId ? states.get(childId) : null;
    },
    async updateFamilyChildState(familyId, childId, state, expectedVersion) {
      const current = await this.getFamilyChildState(familyId, childId);
      if (!current || current.version !== expectedVersion) return null;
      const next = {
        ...current,
        state,
        version: current.version + 1,
      };
      states.set(childId, next);
      return next;
    },
    async deleteFamilyChild(familyId, childId) {
      if (children.get(childId)?.familyId !== familyId) return false;
      children.delete(childId);
      states.delete(childId);
      return true;
    },
    async revokeFamily(familyId) {
      for (const [childId, child] of children) {
        if (child.familyId === familyId) {
          children.delete(childId);
          states.delete(childId);
        }
      }
      for (const [tokenHash, session] of sessions) {
        if (session.familyId === familyId) sessions.delete(tokenHash);
      }
      families.delete(familyId);
    },
  };
}

function request(path, options = {}) {
  return new Request(`https://example.test${path}`, options);
}

test("建立家庭護照只保存雜湊，回傳可抄寫護照碼與安全 session", async () => {
  const repository = createRepository();
  const api = createFamilyPassportApi({
    repository,
    clock: () => new Date("2026-07-30T00:00:00.000Z"),
  });
  const response = await api.create(
    request("/api/v1/family/passports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timeZone: "Asia/Tokyo" }),
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.match(payload.passportCode, /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
  assert.equal(payload.family.timeZone, "Asia/Tokyo");
  assert.match(response.headers.get("set-cookie"), /family_session=/);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.equal(
    [...repository.families.values()][0].codeHash.includes(
      payload.passportCode,
    ),
    false,
  );
});

test("護照碼可在另一部裝置登入，但錯誤碼不透露家庭是否存在", async () => {
  const repository = createRepository();
  const api = createFamilyPassportApi({ repository });
  const created = await api.create(
    request("/api/v1/family/passports", {
      method: "POST",
      body: JSON.stringify({ timeZone: "America/Vancouver" }),
    }),
  );
  const { passportCode } = await created.json();

  const loggedIn = await api.login(
    request("/api/v1/family/session", {
      method: "POST",
      body: JSON.stringify({ passportCode }),
    }),
  );
  const rejected = await api.login(
    request("/api/v1/family/session", {
      method: "POST",
      body: JSON.stringify({ passportCode: "AAAA-BBBB-CCCC-DDDD" }),
    }),
  );

  assert.equal(loggedIn.status, 201);
  assert.equal(rejected.status, 401);
  assert.equal((await rejected.json()).error.code, "unauthorized");
});

test("同一家庭可建立多位孩子，狀態以家庭與孩子雙重邊界隔離", async () => {
  const repository = createRepository();
  const api = createFamilyPassportApi({ repository });
  const created = await api.create(
    request("/api/v1/family/passports", {
      method: "POST",
      body: JSON.stringify({ timeZone: "Asia/Singapore" }),
    }),
  );
  const { csrfToken } = await created.json();
  const cookie = created.headers.get("set-cookie").split(";")[0];
  const auth = await api.authorize(
    request("/api/v1/family/children", {
      method: "POST",
      headers: { cookie, "x-csrf-token": csrfToken },
    }),
    { requireCsrf: true },
  );
  const state = createDefaultState("device-child-a");
  const first = await api.createChild(
    request("/api/v1/family/children", {
      method: "POST",
      body: JSON.stringify({ alias: "小舟", state }),
    }),
    auth.familyId,
  );
  const second = await api.createChild(
    request("/api/v1/family/children", {
      method: "POST",
      body: JSON.stringify({
        alias: "小樓",
        state: { ...state, deviceId: "device-child-b" },
      }),
    }),
    auth.familyId,
  );
  const firstPayload = await first.json();
  const secondPayload = await second.json();

  assert.notEqual(firstPayload.child.id, secondPayload.child.id);
  assert.equal(repository.states.get(firstPayload.child.id).state.deviceId, "device-child-a");
  assert.equal(repository.states.get(secondPayload.child.id).state.deviceId, "device-child-b");
});

test("家庭狀態拒收 Email、答案與自由文字等不必要個資", async () => {
  const repository = createRepository();
  const api = createFamilyPassportApi({ repository });
  const validState = createDefaultState("device-privacy");

  for (const state of [
    { ...validState, email: "child@example.com" },
    { ...validState, Email: "child@example.com" },
    { ...validState, memo: "孩子真名" },
    { ...validState, nested: { student_name: "Alice" } },
    { ...validState, answers: { q1: "甲" } },
    { ...validState, reflection: "今天的私人心得" },
    {
      ...validState,
      preferences: { ...validState.preferences, memo: "Alice" },
    },
    { ...validState, schemaVersion: 999, deviceId: "bad" },
  ]) {
    const response = await api.createChild(
      request("/api/v1/family/children", {
        method: "POST",
        body: JSON.stringify({ alias: "小舟", state }),
      }),
      "family-1",
    );
    assert.equal(response.status, 400);
  }
});

test("刪除家庭會實體移除護照、sessions、孩子與狀態", async () => {
  const repository = createRepository();
  const api = createFamilyPassportApi({ repository });
  const created = await api.create(
    request("/api/v1/family/passports", {
      method: "POST",
      body: JSON.stringify({ timeZone: "America/Toronto" }),
    }),
  );
  const { csrfToken, family } = await created.json();
  const cookie = created.headers.get("set-cookie").split(";")[0];
  const authorization = await api.authorize(
    request("/api/v1/family/passports/current", {
      method: "DELETE",
      headers: { cookie, "x-csrf-token": csrfToken },
    }),
    { requireCsrf: true },
  );
  await api.createChild(
    request("/api/v1/family/children", {
      method: "POST",
      body: JSON.stringify({
        alias: "小舟",
        state: createDefaultState("device-delete"),
      }),
    }),
    authorization.familyId,
  );

  const response = await api.deleteFamily(authorization.familyId);

  assert.equal(response.status, 204);
  assert.equal(repository.families.has(family.id), false);
  assert.equal(repository.sessions.size, 0);
  assert.equal(repository.children.size, 0);
  assert.equal(repository.states.size, 0);
});

test("公開路由允許建立與登入，孩子與刪除操作必須有家庭 session 與 CSRF", async () => {
  const calls = [];
  const familyPassportApi = {
    create: async () => {
      calls.push("create");
      return Response.json({}, { status: 201 });
    },
    login: async () => {
      calls.push("login");
      return Response.json({}, { status: 201 });
    },
    authorize: async (_request, { requireCsrf } = {}) =>
      requireCsrf
        ? { ok: false }
        : { ok: true, familyId: "family-1" },
    unauthorizedResponse: () =>
      Response.json({ error: { code: "unauthorized" } }, { status: 401 }),
  };
  const api = createApi({
    repository: { getPublishedDaily: async () => [] },
    familyPassportApi,
  });

  const created = await api.fetch(
    request("/api/v1/family/passports", { method: "POST" }),
  );
  const loggedIn = await api.fetch(
    request("/api/v1/family/session", { method: "POST" }),
  );
  const childRejected = await api.fetch(
    request("/api/v1/family/children", { method: "POST" }),
  );

  assert.equal(created.status, 201);
  assert.equal(loggedIn.status, 201);
  assert.equal(childRejected.status, 401);
  assert.deepEqual(calls, ["create", "login"]);
});
