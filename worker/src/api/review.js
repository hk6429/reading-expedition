import { hashSecret } from "../auth/teacher-auth.js";
import { errorResponse, jsonResponse } from "./errors.js";

const REVIEW_STATUSES = new Set([
  "draft",
  "review",
  "published",
  "withdrawn",
  "archived",
]);
const EDITABLE_FIELDS = new Set([
  "title",
  "hookQuestion",
  "body",
  "glossary",
  "readingMinutes",
  "assessment",
]);

function traceId() {
  return crypto.randomUUID();
}

function allowedChanges(payload) {
  const changes = {};
  for (const [key, value] of Object.entries(payload)) {
    if (EDITABLE_FIELDS.has(key)) changes[key] = value;
  }
  return changes;
}

export function createReviewApi({ repository }) {
  if (!repository || typeof repository.getReviewPackage !== "function") {
    throw new TypeError("review repository is required");
  }

  return Object.freeze({
    async list(request) {
      const status = new URL(request.url).searchParams.get("status") ?? "review";
      if (!REVIEW_STATUSES.has(status)) {
        return errorResponse(
          "invalid_review_status",
          "校閱狀態不正確。",
          400,
          traceId(),
        );
      }
      const packages = await repository.listReviewPackages(status);
      return jsonResponse(
        { packages },
        { headers: { "cache-control": "no-store" } },
      );
    },

    async detail(id) {
      const packageRecord = await repository.getReviewPackage(id);
      if (!packageRecord) {
        return errorResponse(
          "not_found",
          "找不到指定校閱稿。",
          404,
          traceId(),
        );
      }
      return jsonResponse(
        { package: packageRecord },
        { headers: { "cache-control": "no-store" } },
      );
    },

    async update(id, request, actorId) {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return errorResponse(
          "invalid_review_edit",
          "修改資料格式不正確。",
          400,
          traceId(),
        );
      }
      if (!Number.isInteger(payload.expectedVersion)) {
        return errorResponse(
          "version_required",
          "修改前必須確認稿件版本。",
          400,
          traceId(),
        );
      }
      const before = await repository.getReviewPackage(id);
      if (!before) {
        return errorResponse("not_found", "找不到指定校閱稿。", 404, traceId());
      }
      const changes = allowedChanges(payload);
      if (Object.keys(changes).length === 0) {
        return errorResponse(
          "empty_review_edit",
          "沒有可儲存的修改。",
          400,
          traceId(),
        );
      }
      const updated = await repository.updateReviewPackage(
        id,
        changes,
        payload.expectedVersion,
      );
      if (!updated) {
        return errorResponse(
          "version_conflict",
          "稿件已被更新，請重新載入後再修改。",
          409,
          traceId(),
        );
      }
      await repository.appendReviewEvent({
        id: crypto.randomUUID(),
        packageId: id,
        actorId,
        action: "edited",
        reasonCode: null,
        note: null,
        beforeHash: await hashSecret(JSON.stringify(before)),
        afterHash: await hashSecret(JSON.stringify(updated)),
      });
      return jsonResponse(
        { package: updated },
        { headers: { "cache-control": "no-store" } },
      );
    },

    async batch(request) {
      let payload;
      try {
        payload = await request.json();
      } catch {
        payload = null;
      }
      const keys = payload ? Object.keys(payload) : [];
      const allowed =
        payload &&
        Array.isArray(payload.ids) &&
        payload.ids.length > 0 &&
        payload.action === "archived" &&
        keys.every((key) => key === "ids" || key === "action");
      if (!allowed) {
        return errorResponse(
          "unsafe_batch_operation",
          "批次操作不能修改題目、答案或核准稿件。",
          400,
          traceId(),
        );
      }
      return jsonResponse({ accepted: true, count: payload.ids.length });
    },
  });
}
