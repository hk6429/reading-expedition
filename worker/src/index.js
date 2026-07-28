import { createApi } from "./api/router.js";
import { createReadingRepository } from "./db/repository.js";

export default {
  fetch(request, env) {
    const repository = createReadingRepository(env.READING_DB);
    return createApi({ repository }).fetch(request);
  },
};
