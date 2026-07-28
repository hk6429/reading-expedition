import { createApi } from "./api/router.js";
import { createPublicationApi } from "./api/publication.js";
import { createReviewApi } from "./api/review.js";
import { createClassroomApi } from "./api/classroom.js";
import { createEventsApi } from "./api/events.js";
import { createTeacherSessionApi } from "./api/teacher-session.js";
import { createReadingRepository } from "./db/repository.js";
import { createPipelineRuntime } from "./pipeline/pipeline-runtime.js";

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
    return createApi({
      repository,
      teacherSessionApi,
      reviewApi,
      publicationApi,
      classroomApi,
      eventsApi,
    }).fetch(request);
  },
  async scheduled(_event, env) {
    const repository = createReadingRepository(env.READING_DB);
    await createPipelineRuntime({ env, repository }).run();
  },
};
