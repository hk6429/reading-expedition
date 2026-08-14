import { createApi } from "./api/router.js";
import { createPublicationApi } from "./api/publication.js";
import { createReviewApi } from "./api/review.js";
import { createClassroomApi } from "./api/classroom.js";
import { createEventsApi } from "./api/events.js";
import { createTeacherSessionApi } from "./api/teacher-session.js";
import { createFamilyPassportApi } from "./api/family-passport.js";
import { createReadingRepository } from "./db/repository.js";
import { tursoD1 } from "./_tursod1.js";

export default {
  fetch(request, env) {
    // D1 → Turso 切換層：設定了 TURSO_URL/TURSO_TOKEN 就以 Turso 取代 READING_DB（D1 binding 保留當備援，刪掉 secret 即回退 D1）。
    if (env.TURSO_URL && env.TURSO_TOKEN) {
      env = { ...env, READING_DB: tursoD1(env) };
    }
    const repository = createReadingRepository(env.READING_DB);
    const teacherSessionApi = createTeacherSessionApi({
      repository,
      teacherKeyHash: env.TEACHER_KEY_HASH,
    });
    const reviewApi = createReviewApi({ repository });
    const publicationApi = createPublicationApi({ repository });
    const classroomApi = createClassroomApi({ repository });
    const eventsApi = createEventsApi({ repository });
    const familyPassportApi = createFamilyPassportApi({ repository });
    return createApi({
      repository,
      teacherSessionApi,
      reviewApi,
      publicationApi,
      classroomApi,
      eventsApi,
      familyPassportApi,
    }).fetch(request);
  },
};
