import assert from "node:assert/strict";
import test from "node:test";

import { createFamilyClient } from "../../src/storage/family-client.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    snapshot: () => Object.fromEntries(values),
  };
}

test("建立護照只保存 CSRF 與孩子版本，不在瀏覽器保存護照碼", async () => {
  const storage = memoryStorage();
  const calls = [];
  const client = createFamilyClient({
    storage,
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return Response.json(
        {
          passportCode: "ABCD-EFGH-JKLM-NPQR",
          csrfToken: "csrf-1",
          family: { id: "family-1", timeZone: "Asia/Tokyo", children: [] },
        },
        { status: 201 },
      );
    },
  });

  const result = await client.createPassport("Asia/Tokyo");
  const snapshot = storage.snapshot();

  assert.equal(result.passportCode, "ABCD-EFGH-JKLM-NPQR");
  assert.equal(snapshot["reading-expedition:family-csrf"], "csrf-1");
  assert.doesNotMatch(JSON.stringify(snapshot), /ABCD-EFGH/);
  assert.equal(calls[0][0], "/api/v1/family/passports");
});

test("孩子狀態同步使用版本鎖並更新本機版本", async () => {
  const storage = memoryStorage();
  storage.setItem("reading-expedition:family-csrf", "csrf-1");
  storage.setItem(
    "reading-expedition:active-child",
    JSON.stringify({ id: "child-1", alias: "小舟", stateVersion: 2 }),
  );
  const client = createFamilyClient({
    storage,
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/v1/family/children/child-1/state");
      assert.equal(options.headers["x-csrf-token"], "csrf-1");
      assert.equal(JSON.parse(options.body).expectedVersion, 2);
      return Response.json({
        childId: "child-1",
        state: {},
        version: 3,
      });
    },
  });

  await client.syncActiveChild({ schemaVersion: 2, deviceId: "device-1" });

  assert.equal(client.activeChild().stateVersion, 3);
  assert.equal(client.syncStatus().status, "synced");
  assert.match(client.syncStatus().syncedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("同步衝突會留下可見待處理狀態，不會被當成成功", async () => {
  const storage = memoryStorage();
  storage.setItem("reading-expedition:family-csrf", "csrf-1");
  storage.setItem(
    "reading-expedition:active-child",
    JSON.stringify({ id: "child-1", alias: "小舟", stateVersion: 2 }),
  );
  const client = createFamilyClient({
    storage,
    fetchImpl: async () =>
      Response.json(
        {
          error: {
            code: "version_conflict",
            message: "另一部裝置已更新紀錄，請重新載入後再試。",
          },
        },
        { status: 409 },
      ),
  });

  await assert.rejects(
    () => client.syncActiveChild({ schemaVersion: 2 }),
    /另一部裝置/,
  );
  assert.equal(client.syncStatus().status, "conflict");
  assert.equal(client.syncStatus().errorCode, "version_conflict");
});
