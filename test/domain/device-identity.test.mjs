import assert from "node:assert/strict";
import test from "node:test";

import { createAnonymousDeviceId } from "../../src/domain/device-identity.js";

test("匿名裝置 ID 只使用隨機值，不組合瀏覽器特徵", () => {
  let calls = 0;
  const id = createAnonymousDeviceId(() => {
    calls += 1;
    return "123e4567-e89b-12d3-a456-426614174000";
  });

  assert.equal(id, "reader-123e4567-e89b-12d3-a456-426614174000");
  assert.equal(calls, 1);
});
