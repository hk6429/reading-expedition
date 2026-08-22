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

function isoWeekKey(date) {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate - yearStart) / 86_400_000 + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weeklyProgressBand(validReadings) {
  if (validReadings >= 10) return "goal_reached";
  if (validReadings >= 7) return "near_goal";
  if (validReadings >= 4) return "growing";
  return "starting";
}

function landmarkProgressBand(validReadings) {
  if (validReadings >= 30) return "established";
  if (validReadings >= 10) return "rising";
  return "foundation";
}

const MISSION_TYPES = new Set([
  "shared_readings",
  "category_balance",
  "ability_practice",
]);
const EXIT_CODES = new Set([
  "found_evidence",
  "changed_view",
  "need_support",
]);
const ASSIGNMENT_ABILITIES = new Set([
  "comprehension",
  "inference",
  "evidence",
]);
const ASSIGNMENT_ROUTES = new Set([
  "guided",
  "independent",
  "equivalent",
]);

function parseMissionPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value).sort().join(",");
  if (keys !== "type" && keys !== "target,type") return null;
  if (!MISSION_TYPES.has(value.type)) return null;
  if ("target" in value && value.target !== 0) return null;
  return Object.freeze({
    type: value.type,
    target: value.target === 0 ? 0 : 10,
  });
}

function parseVotePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).join(",") !== "choice") return null;
  return MISSION_TYPES.has(value.choice) ? value.choice : null;
}

function parseExitPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).join(",") !== "code") return null;
  return EXIT_CODES.has(value.code) ? value.code : null;
}

function validIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseAssignmentPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    Object.keys(value).sort().join(",") !==
    "ability,dueDate,readingId,route,title"
  ) {
    return null;
  }
  if (
    typeof value.readingId !== "string" ||
    !/^[A-Za-z0-9-]{1,120}$/.test(value.readingId) ||
    typeof value.title !== "string" ||
    value.title !== value.title.trim() ||
    value.title.length < 1 ||
    value.title.length > 160 ||
    /[\u0000-\u001f\u007f]/.test(value.title) ||
    !ASSIGNMENT_ABILITIES.has(value.ability) ||
    !ASSIGNMENT_ROUTES.has(value.route) ||
    (value.dueDate !== null && !validIsoDate(value.dueDate))
  ) {
    return null;
  }
  return Object.freeze({
    readingId: value.readingId,
    title: value.title,
    ability: value.ability,
    route: value.route,
    dueDate: value.dueDate,
  });
}

function parseContributionQuality(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    Object.keys(value).sort().join(",") !==
    "evidenceViewed,firstCorrect,revisedCorrect,transferCompleted"
  ) {
    return null;
  }
  if (
    !Number.isInteger(value.firstCorrect) ||
    value.firstCorrect < 0 ||
    value.firstCorrect > 3 ||
    !Number.isInteger(value.revisedCorrect) ||
    value.revisedCorrect < 0 ||
    value.revisedCorrect > 3 ||
    typeof value.evidenceViewed !== "boolean" ||
    typeof value.transferCompleted !== "boolean"
  ) {
    return null;
  }
  return Object.freeze({ ...value });
}

const MISSION_CHOICES = [
  "shared_readings",
  "category_balance",
  "ability_practice",
];
const MISSION_EXIT_CODES = [
  "found_evidence",
  "changed_view",
  "need_support",
];

function aggregateDistribution(counts, keys) {
  return Object.fromEntries(
    keys.map((key) => [key, Number(counts?.[key] ?? 0)]),
  );
}

function roundedRate(numerator, denominator) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100) / 100;
}

function qualityRates(quality) {
  return {
    firstCorrectRate: roundedRate(quality.firstCorrect, quality.count * 3),
    revisedCorrectRate: roundedRate(quality.revisedCorrect, quality.count * 3),
    evidenceViewedRate: roundedRate(quality.evidenceViewed, quality.count),
    transferCompletedRate: roundedRate(
      quality.transferCompleted,
      quality.count,
    ),
  };
}

function emptyMissionContext() {
  return {
    mission: null,
    voteParticipants: 0,
    voteCounts: {},
    exitParticipants: 0,
    exitCounts: {},
    currentAssignment: null,
    quality: {
      count: 0,
      firstCorrect: 0,
      revisedCorrect: 0,
      evidenceViewed: 0,
      transferCompleted: 0,
    },
  };
}

export function createClassroomApi({
  repository,
  completionProofService = null,
  clock = () => new Date(),
  privacyThreshold = 5,
  contributionRateLimit = 3,
  classroomContributionRateLimit = 120,
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
        {
          id: record.id,
          classCode,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
        },
        { status: 201, headers: { "cache-control": "no-store" } },
      );
    },

    async list() {
      const classrooms = await repository.listClassrooms();
      const weeklyPeriod = isoWeekKey(clock());
      const enriched = await Promise.all(
        classrooms.map(async (classroom) => {
          if (
            typeof repository.getClassAggregate !== "function" ||
            typeof repository.getClassMissionContext !== "function"
          ) {
            return classroom;
          }
          const [aggregate, context] = await Promise.all([
            repository.getClassAggregate(classroom.id, weeklyPeriod),
            repository.getClassMissionContext(classroom.id, weeklyPeriod),
          ]);
          const mission = context.mission ?? {
            type: "shared_readings",
            target: 10,
          };
          const privacyProtected =
            aggregate.anonymousParticipants < privacyThreshold ||
            aggregate.weeklyAnonymousParticipants < privacyThreshold;
          const remaining = Math.max(
            0,
            mission.target - aggregate.weeklyValidReadings,
          );
          return {
            ...classroom,
            privacyProtected,
            participantThreshold: privacyThreshold,
            weeklyPeriod,
            weeklyValidReadings: privacyProtected
              ? null
              : aggregate.weeklyValidReadings,
            weeklyMissionTarget: mission.target,
            mission,
            missionProgress: privacyProtected
              ? null
              : mission.target === 0
                ? 0
                : aggregate.weeklyValidReadings,
            missionRemaining: privacyProtected
              ? null
              : mission.target === 0
                ? 0
                : remaining,
            currentAssignment: context.currentAssignment,
            categoryDistribution: privacyProtected
              ? null
              : aggregate.categoryDistribution,
            skillDistribution: privacyProtected
              ? null
              : aggregate.skillDistribution,
            voteDistribution:
              context.voteParticipants >= privacyThreshold
                ? aggregateDistribution(context.voteCounts, MISSION_CHOICES)
                : null,
            exitDistribution:
              context.exitParticipants >= privacyThreshold
                ? aggregateDistribution(
                    context.exitCounts,
                    MISSION_EXIT_CODES,
                  )
                : null,
            qualityRates:
              !privacyProtected && context.quality.count >= privacyThreshold
                ? qualityRates(context.quality)
                : null,
          };
        }),
      );
      return jsonResponse(
        { classrooms: enriched },
        { headers: { "cache-control": "no-store" } },
      );
    },

    async revoke(classroomId) {
      if (
        typeof classroomId !== "string" ||
        !/^[A-Za-z0-9-]{1,80}$/.test(classroomId)
      ) {
        return errorResponse(
          "classroom_not_found",
          "找不到指定班級。",
          404,
          crypto.randomUUID(),
        );
      }
      const revokedAt = clock().toISOString();
      const revoked = await repository.revokeClassroom(classroomId, revokedAt);
      if (!revoked) {
        return errorResponse(
          "classroom_not_found",
          "找不到指定班級，或班級已停用。",
          404,
          crypto.randomUUID(),
        );
      }
      return jsonResponse(
        { ok: true, revokedAt },
        { headers: { "cache-control": "no-store" } },
      );
    },

    async setMission(classroomId, request, actorId) {
      if (
        typeof classroomId !== "string" ||
        !/^[A-Za-z0-9-]{1,80}$/.test(classroomId)
      ) {
        return errorResponse(
          "classroom_not_found",
          "找不到指定班級。",
          404,
          crypto.randomUUID(),
        );
      }
      let mission;
      try {
        mission = parseMissionPayload(await request.json());
      } catch {
        mission = null;
      }
      if (!mission) {
        return errorResponse(
          "invalid_class_mission",
          "共同任務格式不正確。",
          400,
          crypto.randomUUID(),
        );
      }
      const now = clock();
      const saved = await repository.setClassMission({
        classroomId,
        period: isoWeekKey(now),
        ...mission,
        createdBySession: actorId,
        updatedAt: now.toISOString(),
      });
      if (!saved) {
        return errorResponse(
          "classroom_not_found",
          "找不到指定班級，或班級已停用。",
          404,
          crypto.randomUUID(),
        );
      }
      return jsonResponse(
        { mission },
        { headers: { "cache-control": "no-store" } },
      );
    },

    async setAssignment(classroomId, request, actorId) {
      if (
        typeof classroomId !== "string" ||
        !/^[A-Za-z0-9-]{1,80}$/.test(classroomId)
      ) {
        return errorResponse(
          "classroom_not_found",
          "找不到指定班級。",
          404,
          crypto.randomUUID(),
        );
      }
      let assignment;
      try {
        assignment = parseAssignmentPayload(await request.json());
      } catch {
        assignment = null;
      }
      if (!assignment) {
        return errorResponse(
          "invalid_class_assignment",
          "指定閱讀格式不正確。",
          400,
          crypto.randomUUID(),
        );
      }
      const now = clock();
      const saved = await repository.setClassAssignment({
        classroomId,
        ...assignment,
        createdBySession: actorId,
        updatedAt: now.toISOString(),
      });
      if (!saved) {
        return errorResponse(
          "classroom_not_found",
          "找不到指定班級，或班級已停用。",
          404,
          crypto.randomUUID(),
        );
      }
      return jsonResponse(
        { currentAssignment: assignment },
        { headers: { "cache-control": "no-store" } },
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
      const since = new Date(clock().getTime() - 60_000).toISOString();
      if (typeof repository.countRecentClassContributions === "function") {
        const recentCount = await repository.countRecentClassContributions(
          participant.id,
          since,
        );
        if (recentCount >= contributionRateLimit) {
          return errorResponse(
            "class_contribution_limited",
            "班級共建操作過於頻繁，請稍後再試。",
            429,
            crypto.randomUUID(),
          );
        }
      }
      if (
        typeof repository.countRecentClassroomContributions === "function"
      ) {
        const classroomRecentCount =
          await repository.countRecentClassroomContributions(
            participant.classroomId,
            since,
          );
        if (classroomRecentCount >= classroomContributionRateLimit) {
          return errorResponse(
            "classroom_contribution_limited",
            "班級共建操作過於頻繁，請稍後再試。",
            429,
            crypto.randomUUID(),
          );
        }
      }
      let contribution;
      let quality;
      try {
        const payload = await request.json();
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          throw new TypeError("invalid contribution");
        }
        const { quality: rawQuality, ...base } = payload;
        contribution = createClassContribution(base);
        quality =
          rawQuality === undefined ? null : parseContributionQuality(rawQuality);
        if (rawQuality !== undefined && !quality) {
          throw new TypeError("invalid contribution quality");
        }
      } catch {
        return errorResponse(
          "invalid_class_contribution",
          "班級共建資料格式不正確。",
          400,
          crypto.randomUUID(),
        );
      }
      if (!completionProofService) {
        return errorResponse(
          "completion_proof_unavailable",
          "目前無法驗證閱讀完成證明。",
          503,
          crypto.randomUUID(),
        );
      }
      let proof;
      try {
        proof = await completionProofService.verify(
          contribution.completionProof,
        );
      } catch (error) {
        const expired = error?.code === "completion_proof_expired";
        const tooFast = error?.code === "completion_proof_too_fast";
        return errorResponse(
          expired
            ? "completion_proof_expired"
            : tooFast
              ? "class_contribution_too_fast"
              : "completion_proof_invalid",
          expired
            ? "閱讀完成證明已到期。"
            : tooFast
              ? "完成速度超出可驗證範圍，這次不計入班級共建。"
              : "閱讀完成證明無效。",
          tooFast ? 429 : 400,
          crypto.randomUUID(),
        );
      }
      if (
        proof.readingId !== contribution.readingId ||
        proof.contentKey !== contribution.contentKey ||
        proof.version !== contribution.version ||
        proof.passed !== true
      ) {
        return errorResponse(
          "completion_proof_mismatch",
          "閱讀完成證明與貢獻內容不一致。",
          400,
          crypto.randomUUID(),
        );
      }
      const accepted = await repository.addClassContribution({
        classroomId: participant.classroomId,
        participantId: participant.id,
        contentId: proof.readingId,
        canonicalContentKey: proof.contentKey,
        readingVersion: proof.version,
        category: proof.category,
        skill: proof.skill,
        proofNonce: proof.nonce,
        period: isoWeekKey(clock()),
        createdAt: clock().toISOString(),
        quality,
      });
      if (!accepted) {
        return errorResponse(
          "class_contribution_conflict",
          "這份完成證明或同篇閱讀已計入班級共建。",
          409,
          crypto.randomUUID(),
        );
      }
      return new Response(null, { status: 202 });
    },

    async vote(request) {
      const participant = await authorizeParticipant(request);
      if (!participant) {
        return errorResponse(
          "unauthorized",
          "匿名參與權杖無效。",
          401,
          crypto.randomUUID(),
        );
      }
      let choice;
      try {
        choice = parseVotePayload(await request.json());
      } catch {
        choice = null;
      }
      if (!choice) {
        return errorResponse(
          "invalid_class_mission_vote",
          "共同任務投票格式不正確。",
          400,
          crypto.randomUUID(),
        );
      }
      const now = clock();
      const accepted = await repository.addClassMissionVote({
        classroomId: participant.classroomId,
        participantId: participant.id,
        period: isoWeekKey(now),
        choice,
        createdAt: now.toISOString(),
      });
      if (!accepted) {
        return errorResponse(
          "class_mission_vote_conflict",
          "本週已完成共同任務投票。",
          409,
          crypto.randomUUID(),
        );
      }
      return new Response(null, { status: 202 });
    },

    async exit(request) {
      const participant = await authorizeParticipant(request);
      if (!participant) {
        return errorResponse(
          "unauthorized",
          "匿名參與權杖無效。",
          401,
          crypto.randomUUID(),
        );
      }
      let code;
      try {
        code = parseExitPayload(await request.json());
      } catch {
        code = null;
      }
      if (!code) {
        return errorResponse(
          "invalid_class_mission_exit",
          "共同任務結束單格式不正確。",
          400,
          crypto.randomUUID(),
        );
      }
      const now = clock();
      await repository.upsertClassMissionExit({
        classroomId: participant.classroomId,
        participantId: participant.id,
        period: isoWeekKey(now),
        code,
        updatedAt: now.toISOString(),
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
      const weeklyPeriod = isoWeekKey(clock());
      const aggregate = await repository.getClassAggregate(
        participant.classroomId,
        weeklyPeriod,
      );
      const context =
        typeof repository.getClassMissionContext === "function"
          ? await repository.getClassMissionContext(
              participant.classroomId,
              weeklyPeriod,
            )
          : emptyMissionContext();
      const mission = context.mission ?? {
        type: "shared_readings",
        target: 10,
      };
      const landmarkLevel = Math.min(
        5,
        Math.floor(aggregate.validReadings / 10),
      );
      const nextLevelAt =
        landmarkLevel >= 5 ? 50 : (landmarkLevel + 1) * 10;
      const remainingToNextLevel = Math.max(
        0,
        nextLevelAt - aggregate.validReadings,
      );
      const weeklyMissionTarget = mission.target;
      const weeklyRemainingToGoal = Math.max(
        0,
        weeklyMissionTarget - aggregate.weeklyValidReadings,
      );
      if (
        aggregate.anonymousParticipants < privacyThreshold ||
        aggregate.weeklyAnonymousParticipants < privacyThreshold
      ) {
        return jsonResponse({
          privacyProtected: true,
          participantThreshold: privacyThreshold,
          weeklyPeriod,
          weeklyMissionTarget,
          mission,
          missionProgress: null,
          missionRemaining: null,
          currentAssignment: context.currentAssignment,
          voteDistribution: null,
          exitDistribution: null,
          qualityRates: null,
          landmarkProgressBand: landmarkProgressBand(aggregate.validReadings),
          weeklyProgressBand:
            weeklyMissionTarget === 0
              ? "rest"
              : weeklyProgressBand(aggregate.weeklyValidReadings),
        });
      }
      return jsonResponse({
        privacyProtected: false,
        anonymousParticipants: aggregate.anonymousParticipants,
        validReadings: aggregate.validReadings,
        categoryDistribution: aggregate.categoryDistribution,
        skillDistribution: aggregate.skillDistribution,
        landmarkLevel,
        nextLevelAt,
        remainingToNextLevel,
        weeklyPeriod,
        weeklyValidReadings: aggregate.weeklyValidReadings,
        weeklyMissionTarget,
        weeklyRemainingToGoal,
        mission,
        missionProgress:
          weeklyMissionTarget === 0 ? 0 : aggregate.weeklyValidReadings,
        missionRemaining:
          weeklyMissionTarget === 0 ? 0 : weeklyRemainingToGoal,
        currentAssignment: context.currentAssignment,
        voteDistribution:
          context.voteParticipants >= privacyThreshold
            ? aggregateDistribution(context.voteCounts, MISSION_CHOICES)
            : null,
        exitDistribution:
          context.exitParticipants >= privacyThreshold
            ? aggregateDistribution(context.exitCounts, MISSION_EXIT_CODES)
            : null,
        qualityRates:
          context.quality.count >= privacyThreshold
            ? qualityRates(context.quality)
            : null,
      });
    },
  });
}
