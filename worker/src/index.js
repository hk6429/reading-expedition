import { createApi } from "./api/router.js";
import { createPublicationApi } from "./api/publication.js";
import { createReviewApi } from "./api/review.js";
import { createClassroomApi } from "./api/classroom.js";
import { createEventsApi } from "./api/events.js";
import { createTeacherSessionApi } from "./api/teacher-session.js";
import { createFamilyPassportApi } from "./api/family-passport.js";
import { createReadingRepository } from "./db/repository.js";

export default {
  fetch(request, env) {
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
