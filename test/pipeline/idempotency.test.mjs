import assert from "node:assert/strict";
import test from "node:test";

import {
  createPipelineIdempotencyKey,
  shouldSkipPipelineRun,
} from "../../worker/src/pipeline/idempotency.js";

test("同一天同版本使用同一 idempotency key，成功後不重跑", () => {
  assert.equal(
    createPipelineIdempotencyKey("2026-07-28", "v1"),
    "daily:2026-07-28:v1",
  );
  assert.equal(
    shouldSkipPipelineRun({
      idempotencyKey: "daily:2026-07-28:v1",
      status: "succeeded",
    }),
    true,
  );
  assert.equal(
    shouldSkipPipelineRun({
      idempotencyKey: "daily:2026-07-28:v1",
      status: "failed",
    }),
    false,
  );
});
