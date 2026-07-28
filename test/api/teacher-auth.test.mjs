import assert from "node:assert/strict";
import test from "node:test";

import {
  createOpaqueToken,
  hashSecret,
  verifyTeacherKey,
} from "../../worker/src/auth/teacher-auth.js";

test("教師密鑰只以雜湊值驗證，錯誤輸入回傳相同失敗結果", async () => {
  const expectedHash = await hashSecret("a-long-teacher-key");

  assert.equal(await verifyTeacherKey("a-long-teacher-key", expectedHash), true);
  assert.equal(await verifyTeacherKey("wrong-key", expectedHash), false);
  assert.equal(await verifyTeacherKey("wrong-key", ""), false);
});

test("session 與 CSRF token 使用不可預測的 opaque token", () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.match(second, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});
