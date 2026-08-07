import { hashSecret } from "../auth/teacher-auth.js";
import { errorResponse, jsonResponse } from "./errors.js";

const TRANSITIONS = Object.freeze({
  returned: "draft",
  approved: "review",
  published: "published",
  withdrawn: "withdrawn",
  archived: "archived",
});
const RETURN_REASONS = new Set([
  "evidence_gap",
  "factual_conflict",
  "reading_level",
  "question_quality",
  "license_issue",
  "sensitive_topic",
  "other",
]);
const SAFE_ID = /^[a-zA-Z0-9-]+$/;
const SAFE_PREFIX = /^[a-z0-9]+(?:-[a-z0-9]+)*-?$/;

export function createPublicationApi({ repository }) {
  if (!repository || typeof repository.transitionPublication !== "function") {
    throw new TypeError("publication repository is required");
  }

  return Object.freeze({
    async batch(request, actorId) {
      let payload;
      try {
        payload = await request.json();
      } catch {
        payload = null;
      }
      const ids = Array.isArray(payload?.ids)
        ? [...new Set(payload.ids)]
        : null;
      const contentKeyPrefix = payload?.contentKeyPrefix;
      const hasIds =
        ids !== null &&
        ids.length > 0 &&
        ids.length <= 600 &&
        ids.every((id) => typeof id === "string" && SAFE_ID.test(id));
      const hasPrefix =
        typeof contentKeyPrefix === "string" &&
        contentKeyPrefix.length >= 3 &&
        contentKeyPrefix.length <= 120 &&
        SAFE_PREFIX.test(contentKeyPrefix);
      const keys = payload ? Object.keys(payload) : [];
      if (
        payload?.action !== "published" ||
        hasIds === hasPrefix ||
        !keys.every((key) =>
          ["action", "ids", "contentKeyPrefix", "note"].includes(key),
        ) ||
        (payload.note !== undefined &&
          (typeof payload.note !== "string" || payload.note.length > 200))
      ) {
        return errorResponse(
          "unsafe_batch_operation",
          "批次發布必須限定安全的 contentKey 前綴或明確 ID 清單。",
          400,
          crypto.randomUUID(),
        );
      }

      const candidates = await repository.listBatchPublicationCandidates({
        ids: hasIds ? ids : null,
        contentKeyPrefix: hasPrefix ? contentKeyPrefix : null,
      });
      if (
        candidates.length === 0 ||
        (hasIds && candidates.length !== ids.length)
      ) {
        return errorResponse(
          "batch_scope_not_found",
          "限定範圍內找不到完整的待審稿件。",
          404,
          crypto.randomUUID(),
        );
      }
      if (
        candidates.some(
          (candidate) =>
            candidate.publicationStatus !== "review" ||
            candidate.hardGateStatus !== "passed" ||
            candidate.qualityScore < 92,
        )
      ) {
        return errorResponse(
          "publication_gate_failed",
          "限定範圍內有稿件尚未通過硬門檻與 92 分品質標準。",
          422,
          crypto.randomUUID(),
        );
      }

      // 這是唯一允許放寬 unsafe_batch_operation 的情境：教師已用
      // session + CSRF 通過路由保護，範圍明確，而且整批先通過發布硬門檻。
      const updated = await repository.publishReviewPackages(candidates);
      if (!updated || updated.length !== candidates.length) {
        return errorResponse(
          "version_conflict",
          "部分稿件已被更新，整批未發布，請重新載入後再操作。",
          409,
          crypto.randomUUID(),
        );
      }
      const byId = new Map(updated.map((item) => [item.id, item]));
      const events = await Promise.all(
        candidates.map(async (before) => ({
          id: crypto.randomUUID(),
          packageId: before.id,
          actorId,
          action: "published",
          reasonCode: null,
          note: payload.note ?? "批次發布：已通過硬門檻與品質標準",
          beforeHash: await hashSecret(JSON.stringify(before)),
          afterHash: await hashSecret(JSON.stringify(byId.get(before.id))),
        })),
      );
      await repository.appendReviewEvents(events);
      return jsonResponse(
        { published: updated.map(({ id }) => id), count: updated.length },
        { headers: { "cache-control": "no-store" } },
      );
    },

    async act(id, request, actorId) {
      let payload;
      try {
        payload = await request.json();
      } catch {
        payload = null;
      }
      const action = payload?.action;
      if (
        !action ||
        !(action in TRANSITIONS) ||
        !Number.isInteger(payload.expectedVersion)
      ) {
        return errorResponse(
          "invalid_publication_action",
          "發布操作資料不正確。",
          400,
          crypto.randomUUID(),
        );
      }
      if (
        action === "returned" &&
        !RETURN_REASONS.has(payload.reasonCode)
      ) {
        return errorResponse(
          "return_reason_required",
          "退回稿件必須選擇原因。",
          400,
          crypto.randomUUID(),
        );
      }
      if (
        payload.note !== undefined &&
        (typeof payload.note !== "string" || payload.note.length > 200)
      ) {
        return errorResponse(
          "invalid_review_note",
          "備註不得超過 200 字。",
          400,
          crypto.randomUUID(),
        );
      }

      const before = await repository.getReviewPackage(id);
      if (!before) {
        return errorResponse(
          "not_found",
          "找不到指定校閱稿。",
          404,
          crypto.randomUUID(),
        );
      }
      if (
        action === "published" &&
        (before.hardGateStatus !== "passed" || before.qualityScore < 92)
      ) {
        return errorResponse(
          "publication_gate_failed",
          "稿件尚未通過硬門檻與 92 分品質標準。",
          422,
          crypto.randomUUID(),
        );
      }
      const updated = await repository.transitionPublication(id, {
        status: TRANSITIONS[action],
        expectedVersion: payload.expectedVersion,
      });
      if (!updated) {
        return errorResponse(
          "version_conflict",
          "稿件已被更新，請重新載入後再操作。",
          409,
          crypto.randomUUID(),
        );
      }
      await repository.appendReviewEvent({
        id: crypto.randomUUID(),
        packageId: id,
        actorId,
        action,
        reasonCode: payload.reasonCode ?? null,
        note: payload.note ?? null,
        beforeHash: await hashSecret(JSON.stringify(before)),
        afterHash: await hashSecret(JSON.stringify(updated)),
      });
      return jsonResponse(
        { package: updated },
        { headers: { "cache-control": "no-store" } },
      );
    },
  });
}
