import { createApi } from "./api/router.js";
import { createPublicationApi } from "./api/publication.js";
import { createReviewApi } from "./api/review.js";
import { createClassroomApi } from "./api/classroom.js";
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
    return createApi({
      repository,
      teacherSessionApi,
      reviewApi,
      publicationApi,
      classroomApi,
    }).fetch(request);
  },
  scheduled(_event, env, context) {
    const repository = createReadingRepository(env.READING_DB);
    context.waitUntil(createPipelineRuntime({ env, repository }).run());
  },
};
