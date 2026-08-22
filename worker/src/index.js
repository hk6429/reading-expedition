import { createApi } from "./api/router.js";
import { createCompletionProofService } from "./api/assessment.js";
import { createPublicationApi } from "./api/publication.js";
import { createReviewApi } from "./api/review.js";
import { createClassroomApi } from "./api/classroom.js";
import { createEventsApi } from "./api/events.js";
import { createTeacherSessionApi } from "./api/teacher-session.js";
import { createFamilyPassportApi } from "./api/family-passport.js";
import { createReadingRepository } from "./db/repository.js";
import { tursoD1 } from "./_tursod1.js";

function repositoryFromEnvironment(environment) {
  const env =
    environment.TURSO_URL && environment.TURSO_TOKEN
      ? { ...environment, READING_DB: tursoD1(environment) }
      : environment;
  return createReadingRepository(env.READING_DB);
}

export default {
  fetch(request, env) {
    const repository = repositoryFromEnvironment(env);
    const completionProofService = env.COMPLETION_PROOF_SECRET
      ? createCompletionProofService({ secret: env.COMPLETION_PROOF_SECRET })
      : null;
    const teacherSessionApi = createTeacherSessionApi({
      repository,
      teacherKeyHash: env.TEACHER_KEY_HASH,
    });
    const reviewApi = createReviewApi({ repository });
    const publicationApi = createPublicationApi({ repository });
    const classroomApi = createClassroomApi({
      repository,
      completionProofService,
    });
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
      completionProofService,
    }).fetch(request);
  },
  scheduled(controller, env, ctx) {
    const repository = repositoryFromEnvironment(env);
    const scheduledAt = Number(controller.scheduledTime) || Date.now();
    const cutoffIso = new Date(scheduledAt - 45 * 86_400_000).toISOString();
    ctx.waitUntil(repository.purgeExpiredAnonymousEvents(cutoffIso));
  },
};
