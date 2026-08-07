import {
  assertAssessmentPayload,
  submitAssessment,
} from "./assessment.js";
import { errorResponse, jsonResponse } from "./errors.js";
import {
  getDailyPayload,
  getReadingListPayload,
  getReadingPayload,
  isValidIsoDate,
  parseReadingListQuery,
  taipeiDate,
} from "./public-content.js";

export function createApi({
  repository,
  teacherSessionApi = null,
  reviewApi = null,
  publicationApi = null,
  classroomApi = null,
  eventsApi = null,
  familyPassportApi = null,
  clock = () => new Date(),
}) {
  if (!repository || typeof repository.getPublishedDaily !== "function") {
    throw new TypeError("repository.getPublishedDaily is required");
  }

  return Object.freeze({
    async fetch(request) {
      const traceId = crypto.randomUUID();
      const url = new URL(request.url);
      if (
        eventsApi &&
        url.pathname === "/api/v1/events" &&
        request.method === "POST"
      ) {
        return eventsApi.collect(request);
      }
      if (
        familyPassportApi &&
        url.pathname === "/api/v1/family/passports" &&
        request.method === "POST"
      ) {
        return familyPassportApi.create(request);
      }
      if (
        familyPassportApi &&
        url.pathname === "/api/v1/family/session" &&
        request.method === "POST"
      ) {
        return familyPassportApi.login(request);
      }
      if (
        familyPassportApi &&
        url.pathname.startsWith("/api/v1/family/")
      ) {
        const requireCsrf = request.method !== "GET";
        const authorization = await familyPassportApi.authorize(request, {
          requireCsrf,
        });
        if (!authorization.ok) {
          return familyPassportApi.unauthorizedResponse();
        }
        if (
          url.pathname === "/api/v1/family/session" &&
          request.method === "DELETE"
        ) {
          return familyPassportApi.logout(request);
        }
        if (
          url.pathname === "/api/v1/family/passports/current" &&
          request.method === "GET"
        ) {
          return familyPassportApi.current(authorization.familyId);
        }
        if (
          url.pathname === "/api/v1/family/passports/current" &&
          request.method === "DELETE"
        ) {
          return familyPassportApi.deleteFamily(authorization.familyId);
        }
        if (
          url.pathname === "/api/v1/family/children" &&
          request.method === "POST"
        ) {
          return familyPassportApi.createChild(
            request,
            authorization.familyId,
          );
        }
        const childStateMatch =
          /^\/api\/v1\/family\/children\/([a-zA-Z0-9-]+)\/state$/.exec(
            url.pathname,
          );
        if (childStateMatch && request.method === "GET") {
          return familyPassportApi.childState(
            authorization.familyId,
            childStateMatch[1],
          );
        }
        if (childStateMatch && request.method === "PUT") {
          return familyPassportApi.updateChildState(
            request,
            authorization.familyId,
            childStateMatch[1],
          );
        }
        const childMatch =
          /^\/api\/v1\/family\/children\/([a-zA-Z0-9-]+)$/.exec(
            url.pathname,
          );
        if (childMatch && request.method === "DELETE") {
          return familyPassportApi.deleteChild(
            authorization.familyId,
            childMatch[1],
          );
        }
      }
      if (
        classroomApi &&
        url.pathname === "/api/v1/classrooms/join" &&
        request.method === "POST"
      ) {
        return classroomApi.join(request);
      }
      if (
        classroomApi &&
        url.pathname === "/api/v1/classrooms/contribute" &&
        request.method === "POST"
      ) {
        return classroomApi.contribute(request);
      }
      if (
        classroomApi &&
        url.pathname === "/api/v1/classrooms/landmark" &&
        request.method === "GET"
      ) {
        return classroomApi.landmark(request);
      }
      if (
        teacherSessionApi &&
        url.pathname === "/api/v1/teacher/session" &&
        request.method === "POST"
      ) {
        return teacherSessionApi.login(request);
      }
      if (
        teacherSessionApi &&
        url.pathname === "/api/v1/teacher/session" &&
        request.method === "DELETE"
      ) {
        return teacherSessionApi.logout(request);
      }
      if (
        teacherSessionApi &&
        url.pathname.startsWith("/api/v1/teacher/")
      ) {
        const authorization = await teacherSessionApi.authorize(request, {
          requireCsrf: request.method !== "GET",
        });
        if (!authorization.ok) return teacherSessionApi.unauthorizedResponse();

        if (
          classroomApi &&
          url.pathname === "/api/v1/teacher/classrooms" &&
          request.method === "GET"
        ) {
          return classroomApi.list();
        }
        if (
          classroomApi &&
          url.pathname === "/api/v1/teacher/classrooms" &&
          request.method === "POST"
        ) {
          return classroomApi.create(authorization.sessionId);
        }
        const classroomMatch =
          /^\/api\/v1\/teacher\/classrooms\/([a-zA-Z0-9-]+)$/.exec(
            url.pathname,
          );
        if (
          classroomApi &&
          classroomMatch &&
          request.method === "DELETE"
        ) {
          return classroomApi.revoke(classroomMatch[1]);
        }
        if (
          reviewApi &&
          url.pathname === "/api/v1/teacher/review" &&
          request.method === "GET"
        ) {
          return reviewApi.list(request);
        }
        if (
          publicationApi &&
          url.pathname === "/api/v1/teacher/review/batch/publish" &&
          request.method === "POST"
        ) {
          return publicationApi.batch(request, authorization.sessionId);
        }
        if (
          reviewApi &&
          url.pathname === "/api/v1/teacher/review/batch" &&
          request.method === "POST"
        ) {
          return reviewApi.batch(request, authorization.sessionId);
        }
        const reviewMatch = /^\/api\/v1\/teacher\/review\/([a-zA-Z0-9-]+)$/.exec(
          url.pathname,
        );
        if (reviewApi && reviewMatch && request.method === "GET") {
          return reviewApi.detail(reviewMatch[1]);
        }
        if (reviewApi && reviewMatch && request.method === "PATCH") {
          return reviewApi.update(
            reviewMatch[1],
            request,
            authorization.sessionId,
          );
        }
        const actionMatch =
          /^\/api\/v1\/teacher\/review\/([a-zA-Z0-9-]+)\/action$/.exec(
            url.pathname,
          );
        if (publicationApi && actionMatch && request.method === "POST") {
          return publicationApi.act(
            actionMatch[1],
            request,
            authorization.sessionId,
          );
        }
      }
      const submitMatch =
        /^\/api\/v1\/readings\/([a-zA-Z0-9-]+)\/submit$/.exec(url.pathname);

      if (submitMatch && request.method === "POST") {
        if (typeof repository.getAssessmentKey !== "function") {
          return errorResponse(
            "not_found",
            "找不到指定內容或版本。",
            404,
            traceId,
          );
        }
        let payload;
        try {
          payload = assertAssessmentPayload(await request.json());
        } catch {
          return errorResponse(
            "invalid_assessment",
            "作答資料格式不正確。",
            400,
            traceId,
          );
        }
        const result = await submitAssessment(
          repository,
          submitMatch[1],
          payload,
        );
        if (!result) {
          return errorResponse(
            "not_found",
            "找不到指定內容或版本。",
            404,
            traceId,
          );
        }
        return jsonResponse(result, {
          headers: {
            "cache-control": "no-store",
            "x-trace-id": traceId,
          },
        });
      }

      if (request.method !== "GET") {
        return errorResponse(
          "method_not_allowed",
          "這個網址不接受此操作。",
          405,
          traceId,
        );
      }

      const readingMatch = /^\/api\/v1\/readings\/([a-zA-Z0-9-]+)$/.exec(
        url.pathname,
      );
      if (readingMatch) {
        if (typeof repository.getPublishedReading !== "function") {
          return errorResponse(
            "not_found",
            "找不到指定內容。",
            404,
            traceId,
          );
        }
        const reading = await getReadingPayload(repository, readingMatch[1]);
        if (!reading) {
          return errorResponse(
            "not_found",
            "找不到指定內容。",
            404,
            traceId,
          );
        }
        return jsonResponse(
          { reading },
          {
            headers: {
              "cache-control": "public, max-age=300",
              "x-content-version": String(reading.version),
              "x-trace-id": traceId,
            },
          },
        );
      }

      if (url.pathname === "/api/v1/readings") {
        if (typeof repository.listPublishedReadings !== "function") {
          return errorResponse(
            "not_found",
            "找不到指定內容。",
            404,
            traceId,
          );
        }
        const query = parseReadingListQuery(url);
        if (!query) {
          return errorResponse(
            "invalid_reading_list_query",
            "level、page 或 pageSize 不正確。",
            400,
            traceId,
          );
        }
        const payload = await getReadingListPayload(repository, query);
        return jsonResponse(payload, {
          headers: {
            // 單一階段預期最多約 200 個 package；分頁限制未來批次大小，
            // 傳輸壓縮交由 Cloudflare／Vercel／Netlify 的 HTTP 層處理。
            "cache-control": "public, max-age=300",
            "x-trace-id": traceId,
          },
        });
      }

      if (url.pathname !== "/api/v1/daily") {
        return errorResponse(
          "not_found",
          "找不到指定內容。",
          404,
          traceId,
        );
      }

      const date = url.searchParams.get("date") ?? taipeiDate(clock());
      if (!isValidIsoDate(date)) {
        return errorResponse(
          "invalid_date",
          "日期必須使用有效的 YYYY-MM-DD 格式。",
          400,
          traceId,
        );
      }

      const payload = await getDailyPayload(repository, date);
      return jsonResponse(payload, {
        headers: {
          "cache-control": "public, max-age=300",
          "x-content-date": payload.contentDate,
          "x-trace-id": traceId,
        },
      });
    },
  });
}
