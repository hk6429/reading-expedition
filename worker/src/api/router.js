import {
  assertAssessmentPayload,
  submitAssessment,
} from "./assessment.js";
import { errorResponse, jsonResponse } from "./errors.js";
import {
  getDailyPayload,
  getReadingPayload,
  isValidIsoDate,
  taipeiDate,
} from "./public-content.js";

export function createApi({
  repository,
  teacherSessionApi = null,
  reviewApi = null,
  publicationApi = null,
  classroomApi = null,
  eventsApi = null,
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
          request.method === "POST"
        ) {
          return classroomApi.create(authorization.sessionId);
        }
        if (
          reviewApi &&
          url.pathname === "/api/v1/teacher/review" &&
          request.method === "GET"
        ) {
          return reviewApi.list(request);
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
          "x-content-date": date,
          "x-trace-id": traceId,
        },
      });
    },
  });
}
