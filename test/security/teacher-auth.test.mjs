import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../../worker/src/api/router.js";
import { createTeacherSessionApi } from "../../worker/src/api/teacher-session.js";
import { hashSecret } from "../../worker/src/auth/teacher-auth.js";

test("假教師 header 不能讀草稿或執行審核", async () => {
  const teacherSessionApi = createTeacherSessionApi({
    teacherKeyHash: await hashSecret("real-secret"),
    repository: {
      getTeacherSession: async () => null,
      createTeacherSession: async () => {},
      revokeTeacherSession: async () => {},
    },
  });
  const api = createApi({
    repository: { getPublishedDaily: async () => [] },
    teacherSessionApi,
  });
  for (const method of ["GET", "POST"]) {
    const response = await api.fetch(
      new Request("https://example.test/api/v1/teacher/review", {
        method,
        headers: { "x-role": "teacher", authorization: "Bearer fake" },
      }),
    );
    assert.equal(response.status, 401);
  }
});
