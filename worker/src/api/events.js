import { assertEventBatch } from "./event-schema.js";
import { errorResponse, jsonResponse } from "./errors.js";

export function createEventsApi({ repository }) {
  if (typeof repository?.recordAnonymousEvents !== "function") {
    throw new TypeError("repository.recordAnonymousEvents is required");
  }
  return Object.freeze({
    async collect(request) {
      let events;
      try {
        events = assertEventBatch(await request.json());
      } catch {
        return errorResponse(
          "invalid_events",
          "匿名成效事件格式不正確。",
          400,
          crypto.randomUUID(),
        );
      }
      await repository.recordAnonymousEvents(events);
      return jsonResponse(
        { accepted: events.length },
        { status: 202, headers: { "cache-control": "no-store" } },
      );
    },
  });
}
