import { assertEventBatch } from "./event-schema.js";
import { errorResponse, jsonResponse } from "./errors.js";

export function createEventsApi({
  repository,
  clock = () => new Date(),
  rateLimit = 120,
  rateWindowMs = 60_000,
}) {
  if (
    typeof repository?.recordAnonymousEvents !== "function" ||
    typeof repository?.countRecentAnonymousEvents !== "function"
  ) {
    throw new TypeError("event repository methods are required");
  }
  return Object.freeze({
    async collect(request) {
      const contentType = request.headers.get("content-type") ?? "";
      if (
        contentType.split(";", 1)[0].trim().toLowerCase() !==
        "application/json"
      ) {
        return errorResponse(
          "unsupported_media_type",
          "匿名成效事件只接受 JSON。",
          415,
          crypto.randomUUID(),
        );
      }
      const origin = request.headers.get("origin");
      const fetchSite = request.headers.get("sec-fetch-site");
      const directSameOrigin = origin === new URL(request.url).origin;
      if (!origin || (fetchSite !== "same-origin" && !directSameOrigin)) {
        return errorResponse(
          "invalid_event_origin",
          "匿名成效事件只接受本站送出。",
          403,
          crypto.randomUUID(),
        );
      }
      let events;
      try {
        events = assertEventBatch(await request.json(), { now: clock() });
      } catch {
        return errorResponse(
          "invalid_events",
          "匿名成效事件格式不正確。",
          400,
          crypto.randomUUID(),
        );
      }
      const now = clock();
      const cutoffIso = new Date(now.getTime() - rateWindowMs).toISOString();
      const eventsByDevice = new Map();
      for (const event of events) {
        const deviceId = event.context.deviceId;
        const deviceEvents = eventsByDevice.get(deviceId) ?? [];
        deviceEvents.push(event);
        eventsByDevice.set(deviceId, deviceEvents);
      }
      for (const [deviceId, deviceEvents] of eventsByDevice) {
        const recent = await repository.countRecentAnonymousEvents(
          deviceId,
          cutoffIso,
        );
        if (recent + deviceEvents.length > rateLimit) {
          return errorResponse(
            "event_rate_limited",
            "匿名成效事件傳送過於頻繁，請稍後再試。",
            429,
            crypto.randomUUID(),
          );
        }
      }
      const result = await repository.recordAnonymousEvents(events);
      return jsonResponse(
        result,
        { status: 202, headers: { "cache-control": "no-store" } },
      );
    },
  });
}
