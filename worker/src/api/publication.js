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

export function createPublicationApi({ repository }) {
  if (!repository || typeof repository.transitionPublication !== "function") {
    throw new TypeError("publication repository is required");
  }

  return Object.freeze({
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
