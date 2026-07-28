import { createClassContribution } from "../../../src/domain/class-contribution.js";
import {
  createClassCode,
  createParticipantToken,
  hashClassCredential,
} from "../auth/class-code.js";
import { errorResponse, jsonResponse } from "./errors.js";

function bearerToken(request) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
    request.headers.get("authorization") ?? "",
  );
  return match?.[1] ?? null;
}

export function createClassroomApi({
  repository,
  clock = () => new Date(),
  privacyThreshold = 5,
}) {
  async function authorizeParticipant(request) {
    const token = bearerToken(request);
    if (!token) return null;
    const record = await repository.findClassroomToken(
      await hashClassCredential(token),
    );
    if (
      !record ||
      record.revokedAt ||
      new Date(record.expiresAt).getTime() <= clock().getTime()
    ) {
      return null;
    }
    return record;
  }

  return Object.freeze({
    async create(actorId) {
      const classCode = createClassCode();
      const now = clock();
      const record = {
        id: crypto.randomUUID(),
        classCodeHash: await hashClassCredential(classCode),
        createdBySession: actorId,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 180 * 86_400_000).toISOString(),
      };
      await repository.createClassroom(record);
      return jsonResponse(
        { classCode, expiresAt: record.expiresAt },
        { status: 201, headers: { "cache-control": "no-store" } },
      );
    },

    async join(request) {
      let classCode;
      try {
        const payload = await request.json();
        classCode = payload.classCode;
      } catch {
        classCode = "";
      }
      if (typeof classCode !== "string") classCode = "";
      const classroom = await repository.findClassroomByCodeHash(
        await hashClassCredential(classCode),
      );
      if (
        !classroom ||
        classroom.revokedAt ||
        new Date(classroom.expiresAt).getTime() <= clock().getTime()
      ) {
        return errorResponse(
          "classroom_not_found",
          "班級碼無效或已到期。",
          404,
          crypto.randomUUID(),
        );
      }
      const participantToken = createParticipantToken();
      const expiresAt = new Date(
        Math.min(
          new Date(classroom.expiresAt).getTime(),
          clock().getTime() + 90 * 86_400_000,
        ),
      ).toISOString();
      await repository.createClassroomToken({
        id: crypto.randomUUID(),
        classroomId: classroom.id,
        tokenHash: await hashClassCredential(participantToken),
        createdAt: clock().toISOString(),
        expiresAt,
      });
      return jsonResponse(
        { participantToken, expiresAt },
        { status: 201, headers: { "cache-control": "no-store" } },
      );
    },

    async contribute(request) {
      const participant = await authorizeParticipant(request);
      if (!participant) {
        return errorResponse(
          "unauthorized",
          "匿名參與權杖無效。",
          401,
          crypto.randomUUID(),
        );
      }
      let contribution;
      try {
        contribution = createClassContribution(await request.json());
      } catch {
        return errorResponse(
          "invalid_class_contribution",
          "班級共建資料格式不正確。",
          400,
          crypto.randomUUID(),
        );
      }
      await repository.addClassContribution({
        classroomId: participant.classroomId,
        participantId: participant.id,
        ...contribution,
      });
      return new Response(null, { status: 202 });
    },

    async landmark(request) {
      const participant = await authorizeParticipant(request);
      if (!participant) {
        return errorResponse(
          "unauthorized",
          "匿名參與權杖無效。",
          401,
          crypto.randomUUID(),
        );
      }
      const aggregate = await repository.getClassAggregate(
        participant.classroomId,
      );
      if (aggregate.anonymousParticipants < privacyThreshold) {
        return jsonResponse({
          privacyProtected: true,
          participantThreshold: privacyThreshold,
          landmarkLevel: Math.min(5, Math.floor(aggregate.validReadings / 10)),
        });
      }
      return jsonResponse({
        privacyProtected: false,
        anonymousParticipants: aggregate.anonymousParticipants,
        validReadings: aggregate.validReadings,
        categoryDistribution: aggregate.categoryDistribution,
        skillDistribution: aggregate.skillDistribution,
        landmarkLevel: Math.min(5, Math.floor(aggregate.validReadings / 10)),
      });
    },
  });
}
