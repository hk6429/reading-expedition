import { createApi } from "./api/router.js";
import { createTeacherSessionApi } from "./api/teacher-session.js";
import { createReadingRepository } from "./db/repository.js";

export default {
  fetch(request, env) {
    const repository = createReadingRepository(env.READING_DB);
    const teacherSessionApi = createTeacherSessionApi({
      repository,
      teacherKeyHash: env.TEACHER_KEY_HASH,
    });
    return createApi({ repository, teacherSessionApi }).fetch(request);
  },
};
