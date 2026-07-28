import { errorResponse, jsonResponse } from "./errors.js";
import {
  getDailyPayload,
  getReadingPayload,
  isValidIsoDate,
  taipeiDate,
} from "./public-content.js";

export function createApi({ repository, clock = () => new Date() }) {
  if (!repository || typeof repository.getPublishedDaily !== "function") {
    throw new TypeError("repository.getPublishedDaily is required");
  }

  return Object.freeze({
    async fetch(request) {
      const traceId = crypto.randomUUID();
      const url = new URL(request.url);

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
