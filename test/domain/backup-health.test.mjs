import assert from "node:assert/strict";
import test from "node:test";

import { backupHealthStatus } from "../../src/domain/backup-health.js";

test("備份提醒依本機有效閱讀量採溫和里程碑且不阻斷", () => {
  assert.deepEqual(backupHealthStatus(0), {
    shouldRemind: true,
    milestone: 0,
    message: "還沒有閱讀成果；先知道備份位置即可，這次略過不影響使用。",
  });
  assert.equal(backupHealthStatus(1).shouldRemind, true);
  assert.equal(backupHealthStatus(4).shouldRemind, false);
  assert.equal(backupHealthStatus(5).milestone, 5);
  assert.equal(backupHealthStatus(10).milestone, 10);
  assert.equal(backupHealthStatus(11).shouldRemind, false);
  assert.match(backupHealthStatus(20).message, /20/);
});
