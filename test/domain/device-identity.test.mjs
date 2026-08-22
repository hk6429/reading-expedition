import assert from "node:assert/strict";
import test from "node:test";

import {
  createAnonymousDeviceId,
  getRotatingTelemetryId,
} from "../../src/domain/device-identity.js";

test("匿名裝置 ID 只使用隨機值，不組合瀏覽器特徵", () => {
  let calls = 0;
  const id = createAnonymousDeviceId(() => {
    calls += 1;
    return "123e4567-e89b-12d3-a456-426614174000";
  });

  assert.equal(id, "reader-123e4567-e89b-12d3-a456-426614174000");
  assert.equal(calls, 1);
});

test("匿名統計代碼每 35 日輪替且不改動學習紀錄 ID", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  let generated = 0;
  const createId = () => `reader-telemetry-${++generated}`;

  const first = getRotatingTelemetryId(storage, {
    now: new Date("2026-01-01T00:00:00Z"),
    createId,
  });
  const dayThirtyFive = getRotatingTelemetryId(storage, {
    now: new Date("2026-02-04T23:59:59Z"),
    createId,
  });
  const dayThirtySix = getRotatingTelemetryId(storage, {
    now: new Date("2026-02-05T00:00:01Z"),
    createId,
  });

  assert.equal(first, "reader-telemetry-1");
  assert.equal(dayThirtyFive, first);
  assert.equal(dayThirtySix, "reader-telemetry-2");
});
