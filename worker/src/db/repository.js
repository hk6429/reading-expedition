function parseJsonField(value, field) {
  try {
    return JSON.parse(value);
  } catch {
    throw new TypeError(`Stored ${field} is not valid JSON`);
  }
}

function mapPublishedReading(row) {
  return {
    id: row.id,
    contentKey: row.content_key,
    topicDate: row.topic_date,
    category: row.category,
    difficulty: row.difficulty,
    level: row.reading_level ?? "tower",
    supportMode:
      row.support_mode ??
      (row.difficulty === "guided" ? "guided" : "independent"),
    textType: row.text_type,
    title: row.title,
    hookQuestion: row.hook_question,
    readingMinutes: row.reading_minutes,
    glossary: parseJsonField(row.glossary_json, "glossary_json"),
    sourceAttribution: parseJsonField(
      row.source_attribution_json,
      "source_attribution_json",
    ),
    version: row.version,
  };
}

function mapAssessmentItem(row) {
  return {
    id: row.id,
    type: row.item_type,
    prompt: row.prompt,
    options: parseJsonField(row.options_json, "options_json"),
    correctAnswer: row.correct_answer,
    rationale: row.rationale,
    distractorReasons: parseJsonField(
      row.distractor_reasons_json,
      "distractor_reasons_json",
    ),
    evidenceSpan: parseJsonField(row.evidence_span_json, "evidence_span_json"),
  };
}

function mapReviewPackage(row, assessment = []) {
  return {
    id: row.id,
    contentKey: row.content_key,
    category: row.category,
    difficulty: row.difficulty,
    level: row.reading_level ?? "tower",
    supportMode:
      row.support_mode ??
      (row.difficulty === "guided" ? "guided" : "independent"),
    textType: row.text_type,
    title: row.title,
    hookQuestion: row.hook_question,
    body: parseJsonField(row.body, "body"),
    glossary: parseJsonField(row.glossary_json, "glossary_json"),
    readingStrategy: parseJsonField(
      row.reading_strategy_json,
      "reading_strategy_json",
    ),
    readingMinutes: row.reading_minutes,
    sourceAttribution: parseJsonField(
      row.source_attribution_json,
      "source_attribution_json",
    ),
    qualityScore: row.quality_score,
    hardGateStatus: row.hard_gate_status,
    publicationStatus: row.publication_status,
    version: row.version,
    facts: parseJsonField(row.facts_json, "facts_json"),
    sensitivityFlags: parseJsonField(
      row.sensitivity_flags_json,
      "sensitivity_flags_json",
    ),
    assessment,
  };
}

export function createReadingRepository(db) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("A D1-compatible database is required");
  }

  async function loadReviewPackage(id) {
    const row = await db
      .prepare(
        `SELECT
           rp.*,
           fp.category,
           fp.facts_json,
           fp.sensitivity_flags_json
         FROM reading_packages rp
         JOIN fact_packs fp ON fp.id = rp.fact_pack_id
         WHERE rp.id = ?
         LIMIT 1`,
      )
      .bind(id)
      .first();
    if (!row) return null;
    const { results = [] } = await db
      .prepare(
        `SELECT
           id,
           item_type,
           prompt,
           options_json,
           correct_answer,
           rationale,
           distractor_reasons_json,
           evidence_span_json
         FROM assessment_items
         WHERE reading_package_id = ?
         ORDER BY item_type`,
      )
      .bind(id)
      .all();
    return mapReviewPackage(row, results.map(mapAssessmentItem));
  }

  return Object.freeze({
    async recordAnonymousEvents(events) {
      const statements = events.map((event) =>
        db
          .prepare(
            `INSERT INTO anonymous_events
               (id, event_type, occurred_at, content_id, category, difficulty,
                duration_bucket, anonymous_device_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            event.type,
            event.occurredAt,
            event.context.contentId,
            event.context.category,
            event.context.difficulty,
            event.context.durationBucket,
            event.context.deviceId,
          ),
      );
      if (statements.length) await db.batch(statements);
    },
    async createClassroom(record) {
      await db
        .prepare(
          `INSERT INTO classrooms
             (id, class_code_hash, created_by_session, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          record.id,
          record.classCodeHash,
          record.createdBySession,
          record.createdAt,
          record.expiresAt,
        )
        .run();
    },
    async listClassrooms() {
      const result = await db
        .prepare(
          `SELECT
             c.id,
             c.created_at,
             c.expires_at,
             c.revoked_at,
             COUNT(DISTINCT cc.participant_id) AS anonymous_participants,
             COUNT(cc.id) AS valid_readings
           FROM classrooms c
           LEFT JOIN classroom_contributions cc
             ON cc.classroom_id = c.id
           GROUP BY c.id, c.created_at, c.expires_at, c.revoked_at
           ORDER BY c.created_at DESC`,
        )
        .all();
      return (result.results ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        anonymousParticipants: Number(row.anonymous_participants) || 0,
        validReadings: Number(row.valid_readings) || 0,
      }));
    },
    async revokeClassroom(classroomId, revokedAt) {
      const results = await db.batch([
        db
          .prepare(
            `UPDATE classrooms
             SET revoked_at = ?
             WHERE id = ? AND revoked_at IS NULL`,
          )
          .bind(revokedAt, classroomId),
        db
          .prepare(
            `UPDATE classroom_tokens
             SET revoked_at = ?
             WHERE classroom_id = ? AND revoked_at IS NULL`,
          )
          .bind(revokedAt, classroomId),
      ]);
      return Number(results[0]?.meta?.changes) > 0;
    },
    async findClassroomByCodeHash(classCodeHash) {
      const row = await db
        .prepare(
          `SELECT id, expires_at, revoked_at
           FROM classrooms
           WHERE class_code_hash = ?
           LIMIT 1`,
        )
        .bind(classCodeHash)
        .first();
      return row
        ? {
            id: row.id,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at,
          }
        : null;
    },
    async createClassroomToken(record) {
      await db
        .prepare(
          `INSERT INTO classroom_tokens
             (id, classroom_id, token_hash, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          record.id,
          record.classroomId,
          record.tokenHash,
          record.createdAt,
          record.expiresAt,
        )
        .run();
    },
    async findClassroomToken(tokenHash) {
      const row = await db
        .prepare(
          `SELECT id, classroom_id, expires_at, revoked_at
           FROM classroom_tokens
           WHERE token_hash = ?
           LIMIT 1`,
        )
        .bind(tokenHash)
        .first();
      return row
        ? {
            id: row.id,
            classroomId: row.classroom_id,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at,
          }
        : null;
    },
    async addClassContribution(record) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO classroom_contributions
             (id, classroom_id, participant_id, content_id, category, skill, period)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          record.classroomId,
          record.participantId,
          record.contentId,
          record.category,
          record.skill,
          record.period,
        )
        .run();
    },
    async getClassAggregate(classroomId) {
      const summary = await db
        .prepare(
          `SELECT
             COUNT(*) AS valid_readings,
             COUNT(DISTINCT participant_id) AS anonymous_participants
           FROM classroom_contributions
           WHERE classroom_id = ?`,
        )
        .bind(classroomId)
        .first();
      const { results: categoryRows = [] } = await db
        .prepare(
          `SELECT category, COUNT(*) AS count
           FROM classroom_contributions
           WHERE classroom_id = ?
           GROUP BY category`,
        )
        .bind(classroomId)
        .all();
      const { results: skillRows = [] } = await db
        .prepare(
          `SELECT skill, COUNT(*) AS count
           FROM classroom_contributions
           WHERE classroom_id = ?
           GROUP BY skill`,
        )
        .bind(classroomId)
        .all();
      return {
        classroomId,
        validReadings: Number(summary?.valid_readings ?? 0),
        anonymousParticipants: Number(summary?.anonymous_participants ?? 0),
        categoryDistribution: Object.fromEntries(
          categoryRows.map((row) => [row.category, Number(row.count)]),
        ),
        skillDistribution: Object.fromEntries(
          skillRows.map((row) => [row.skill, Number(row.count)]),
        ),
      };
    },
    async getPipelineRun(idempotencyKey) {
      const row = await db
        .prepare(
          `SELECT
             id,
             run_date,
             idempotency_key,
             stage,
             status,
             attempts,
             trace_id,
             error_code,
             error_summary,
             finished_at
           FROM pipeline_runs
           WHERE idempotency_key = ?
           LIMIT 1`,
        )
        .bind(idempotencyKey)
        .first();
      if (!row) return null;
      return {
        id: row.id,
        runDate: row.run_date,
        idempotencyKey: row.idempotency_key,
        stage: row.stage,
        status: row.status,
        attempts: row.attempts,
        traceId: row.trace_id,
        errorCode: row.error_code,
        errorSummary: row.error_summary,
        finishedAt: row.finished_at,
      };
    },
    async startPipelineRun(run) {
      await db
        .prepare(
          `INSERT INTO pipeline_runs
             (id, run_date, idempotency_key, stage, status, attempts, trace_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(idempotency_key) DO UPDATE SET
             stage = excluded.stage,
             status = excluded.status,
             attempts = excluded.attempts,
             trace_id = excluded.trace_id,
             error_code = NULL,
             error_summary = NULL,
             started_at = CURRENT_TIMESTAMP,
             finished_at = NULL`,
        )
        .bind(
          run.id,
          run.runDate,
          run.idempotencyKey,
          run.stage,
          run.status,
          run.attempts,
          run.traceId,
        )
        .run();
    },
    async finishPipelineRun(idempotencyKey, update) {
      await db
        .prepare(
          `UPDATE pipeline_runs
           SET stage = ?,
               status = ?,
               attempts = ?,
               trace_id = ?,
               error_code = ?,
               error_summary = ?,
               finished_at = ?
           WHERE idempotency_key = ?`,
        )
        .bind(
          update.stage,
          update.status,
          update.attempts,
          update.traceId,
          update.errorCode,
          update.errorSummary,
          update.finishedAt,
          idempotencyKey,
        )
        .run();
    },
    async saveDraftIfAbsent(bundle) {
      const existing = await db
        .prepare(
          `SELECT id
           FROM reading_packages
           WHERE content_key = ?
           LIMIT 1`,
        )
        .bind(bundle.contentKey)
        .first();
      if (existing) return false;

      const statements = [
        db
          .prepare(
            `INSERT OR IGNORE INTO sources
               (id, name, base_url, license_type, license_version, allowed_usage, status, last_checked_at)
             VALUES (?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
          )
          .bind(
            bundle.source.id,
            bundle.source.name,
            bundle.source.baseUrl,
            bundle.source.license.type,
            bundle.source.license.version,
            bundle.source.allowedUsage,
          ),
        db
          .prepare(
            `INSERT OR IGNORE INTO source_items
               (id, source_id, canonical_url, title, publisher, published_at, fetched_at,
                content_fingerprint, license_snapshot, extract_scope)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            bundle.sourceItem.id,
            bundle.sourceItem.sourceId,
            bundle.sourceItem.canonicalUrl,
            bundle.sourceItem.title,
            bundle.sourceItem.publisher,
            bundle.sourceItem.publishedAt,
            bundle.sourceItem.fetchedAt,
            bundle.sourceItem.contentFingerprint,
            JSON.stringify(bundle.sourceItem.licenseSnapshot),
            bundle.sourceItem.extractScope,
          ),
        db
          .prepare(
            `INSERT INTO fact_packs
               (id, topic_date, category, facts_json, source_links_json,
                sensitivity_flags_json, verification_status, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            bundle.factPack.id,
            bundle.factPack.topicDate,
            bundle.factPack.category,
            JSON.stringify(bundle.factPack.facts),
            JSON.stringify(bundle.factPack.sourceItemIds),
            JSON.stringify(bundle.factPack.sensitivityFlags),
            bundle.factPack.verificationStatus,
            bundle.factPack.version,
          ),
      ];
      for (const packageRecord of bundle.packages) {
        statements.push(
          db
            .prepare(
              `INSERT INTO reading_packages
                 (id, content_key, fact_pack_id, difficulty, text_type, title, hook_question,
                  body, glossary_json, reading_minutes, source_attribution_json,
                  quality_score, hard_gate_status, publication_status, version,
                  published_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              packageRecord.id,
              bundle.contentKey,
              bundle.factPack.id,
              packageRecord.difficulty,
              packageRecord.textType,
              packageRecord.title,
              packageRecord.hookQuestion,
              JSON.stringify(packageRecord.body),
              JSON.stringify(packageRecord.glossary),
              packageRecord.readingMinutes,
              JSON.stringify(packageRecord.sourceAttribution),
              packageRecord.qualityScore,
              packageRecord.hardGateStatus,
              packageRecord.publicationStatus,
              packageRecord.version,
              packageRecord.publicationStatus === "published"
                ? new Date().toISOString()
                : null,
            ),
        );
        for (const item of packageRecord.assessment) {
          statements.push(
            db
              .prepare(
                `INSERT INTO assessment_items
                   (id, reading_package_id, item_type, prompt, options_json,
                    correct_answer, rationale, distractor_reasons_json,
                    evidence_span_json, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                `${packageRecord.id}-${item.type}`,
                packageRecord.id,
                item.type,
                item.prompt,
                JSON.stringify(item.options),
                item.correctAnswer,
                item.rationale,
                JSON.stringify(item.distractorReasons),
                JSON.stringify(item.evidenceSpan),
                1,
              ),
          );
        }
      }
      await db.batch(statements);
      return true;
    },
    async listReviewPackages(status) {
      const statement = db
        .prepare(
          `SELECT
             rp.id,
             rp.content_key,
             fp.category,
             rp.difficulty,
             rp.reading_level,
             rp.support_mode,
             rp.text_type,
             rp.title,
             rp.quality_score,
             rp.hard_gate_status,
             rp.publication_status,
             rp.version
           FROM reading_packages rp
           JOIN fact_packs fp ON fp.id = rp.fact_pack_id
           WHERE rp.publication_status = ?
           ORDER BY fp.topic_date DESC, rp.content_key, rp.difficulty`,
        )
        .bind(status);
      const { results = [] } = await statement.all();
      return results.map((row) => ({
        id: row.id,
        contentKey: row.content_key,
        category: row.category,
        difficulty: row.difficulty,
        textType: row.text_type,
        title: row.title,
        qualityScore: row.quality_score,
        hardGateStatus: row.hard_gate_status,
        publicationStatus: row.publication_status,
        version: row.version,
      }));
    },
    async getReviewPackage(id) {
      return loadReviewPackage(id);
    },
    async updateReviewPackage(id, changes, expectedVersion) {
      const columnMap = {
        title: ["title", (value) => value],
        hookQuestion: ["hook_question", (value) => value],
        body: ["body", JSON.stringify],
        glossary: ["glossary_json", JSON.stringify],
        readingMinutes: ["reading_minutes", (value) => value],
      };
      const entries = Object.entries(changes).filter(([key]) => key in columnMap);
      if (entries.length === 0 && !Array.isArray(changes.assessment)) return null;
      const setClauses = entries.map(
        ([key]) => `${columnMap[key][0]} = ?`,
      );
      const values = entries.map(([key, value]) => columnMap[key][1](value));
      setClauses.push("version = version + 1", "updated_at = CURRENT_TIMESTAMP");
      const update = await db
        .prepare(
          `UPDATE reading_packages
           SET ${setClauses.join(", ")}
           WHERE id = ? AND version = ?`,
        )
        .bind(...values, id, expectedVersion)
        .run();
      if (!update.meta?.changes) return null;

      if (Array.isArray(changes.assessment) && changes.assessment.length > 0) {
        const statements = changes.assessment.map((item) =>
          db
            .prepare(
              `UPDATE assessment_items
               SET prompt = ?,
                   options_json = ?,
                   correct_answer = ?,
                   rationale = ?,
                   distractor_reasons_json = ?,
                   evidence_span_json = ?,
                   version = version + 1
               WHERE id = ? AND reading_package_id = ?`,
            )
            .bind(
              item.prompt,
              JSON.stringify(item.options),
              item.correctAnswer,
              item.rationale,
              JSON.stringify(item.distractorReasons),
              JSON.stringify(item.evidenceSpan),
              item.id,
              id,
            ),
        );
        await db.batch(statements);
      }
      return loadReviewPackage(id);
    },
    async transitionPublication(id, { status, expectedVersion }) {
      const publishedAt =
        status === "published" ? "CURRENT_TIMESTAMP" : "published_at";
      const withdrawnAt =
        status === "withdrawn" ? "CURRENT_TIMESTAMP" : "withdrawn_at";
      const update = await db
        .prepare(
          `UPDATE reading_packages
           SET publication_status = ?,
               version = version + 1,
               published_at = ${publishedAt},
               withdrawn_at = ${withdrawnAt},
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND version = ?`,
        )
        .bind(status, id, expectedVersion)
        .run();
      if (!update.meta?.changes) return null;
      return loadReviewPackage(id);
    },
    async appendReviewEvent(event) {
      await db
        .prepare(
          `INSERT INTO review_events
             (id, package_id, actor_id, action, reason_code, note, before_hash, after_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          event.id,
          event.packageId,
          event.actorId,
          event.action,
          event.reasonCode,
          event.note,
          event.beforeHash,
          event.afterHash,
        )
        .run();
    },
    async createTeacherSession(session) {
      await db
        .prepare(
          `INSERT INTO teacher_sessions
             (id, token_hash, csrf_hash, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          session.id,
          session.tokenHash,
          session.csrfHash,
          session.expiresAt,
          session.createdAt,
        )
        .run();
    },
    async getTeacherSession(tokenHash) {
      const row = await db
        .prepare(
          `SELECT id, token_hash, csrf_hash, expires_at, revoked_at
           FROM teacher_sessions
           WHERE token_hash = ?
           LIMIT 1`,
        )
        .bind(tokenHash)
        .first();
      if (!row) return null;
      return {
        id: row.id,
        tokenHash: row.token_hash,
        csrfHash: row.csrf_hash,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
      };
    },
    async revokeTeacherSession(tokenHash) {
      await db
        .prepare(
          `UPDATE teacher_sessions
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE token_hash = ? AND revoked_at IS NULL`,
        )
        .bind(tokenHash)
        .run();
    },
    async createFamilyPassport(record) {
      await db
        .prepare(
          `INSERT INTO family_passports
             (id, passport_code_hash, time_zone, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(
          record.id,
          record.codeHash,
          record.timeZone,
          record.createdAt,
        )
        .run();
    },
    async findFamilyByCodeHash(codeHash) {
      const row = await db
        .prepare(
          `SELECT id, passport_code_hash, time_zone, created_at, revoked_at
           FROM family_passports
           WHERE passport_code_hash = ?
           LIMIT 1`,
        )
        .bind(codeHash)
        .first();
      return row
        ? {
            id: row.id,
            codeHash: row.passport_code_hash,
            timeZone: row.time_zone,
            createdAt: row.created_at,
            revokedAt: row.revoked_at,
          }
        : null;
    },
    async getFamilyPassport(familyId) {
      const row = await db
        .prepare(
          `SELECT id, passport_code_hash, time_zone, created_at, revoked_at
           FROM family_passports
           WHERE id = ?
           LIMIT 1`,
        )
        .bind(familyId)
        .first();
      return row
        ? {
            id: row.id,
            codeHash: row.passport_code_hash,
            timeZone: row.time_zone,
            createdAt: row.created_at,
            revokedAt: row.revoked_at,
          }
        : null;
    },
    async createFamilySession(record) {
      await db
        .prepare(
          `INSERT INTO family_sessions
             (id, family_id, token_hash, csrf_hash, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          record.id,
          record.familyId,
          record.tokenHash,
          record.csrfHash,
          record.expiresAt,
          record.createdAt,
        )
        .run();
    },
    async getFamilySession(tokenHash) {
      const row = await db
        .prepare(
          `SELECT
             fs.id,
             fs.family_id,
             fs.token_hash,
             fs.csrf_hash,
             fs.expires_at,
             fs.revoked_at,
             fp.revoked_at AS family_revoked_at
           FROM family_sessions fs
           JOIN family_passports fp ON fp.id = fs.family_id
           WHERE fs.token_hash = ?
           LIMIT 1`,
        )
        .bind(tokenHash)
        .first();
      if (!row || row.family_revoked_at) return null;
      return {
        id: row.id,
        familyId: row.family_id,
        tokenHash: row.token_hash,
        csrfHash: row.csrf_hash,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
      };
    },
    async revokeFamilySession(tokenHash) {
      await db
        .prepare(
          `UPDATE family_sessions
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE token_hash = ? AND revoked_at IS NULL`,
        )
        .bind(tokenHash)
        .run();
    },
    async listFamilyChildren(familyId) {
      const { results = [] } = await db
        .prepare(
          `SELECT
             fc.id,
             fc.alias,
             fc.created_at,
             fc.updated_at,
             fcs.version AS state_version,
             fcs.updated_at AS state_updated_at
           FROM family_children fc
           JOIN family_child_states fcs ON fcs.child_id = fc.id
           WHERE fc.family_id = ?
           ORDER BY fc.created_at`,
        )
        .bind(familyId)
        .all();
      return results.map((row) => ({
        id: row.id,
        alias: row.alias,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        stateVersion: Number(row.state_version),
        stateUpdatedAt: row.state_updated_at,
      }));
    },
    async createFamilyChild(record) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO family_children
               (id, family_id, alias, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(
            record.id,
            record.familyId,
            record.alias,
            record.createdAt,
            record.createdAt,
          ),
        db
          .prepare(
            `INSERT INTO family_child_states
               (child_id, state_json, version, updated_at)
             VALUES (?, ?, 1, ?)`,
          )
          .bind(
            record.id,
            JSON.stringify(record.state),
            record.createdAt,
          ),
      ]);
    },
    async getFamilyChildState(familyId, childId) {
      const row = await db
        .prepare(
          `SELECT
             fcs.child_id,
             fcs.state_json,
             fcs.version,
             fcs.updated_at
           FROM family_child_states fcs
           JOIN family_children fc ON fc.id = fcs.child_id
           WHERE fc.family_id = ? AND fc.id = ?
           LIMIT 1`,
        )
        .bind(familyId, childId)
        .first();
      return row
        ? {
            childId: row.child_id,
            state: parseJsonField(row.state_json, "state_json"),
            version: Number(row.version),
            updatedAt: row.updated_at,
          }
        : null;
    },
    async updateFamilyChildState(
      familyId,
      childId,
      state,
      expectedVersion,
    ) {
      const update = await db
        .prepare(
          `UPDATE family_child_states
           SET state_json = ?,
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE child_id = ?
             AND version = ?
             AND EXISTS (
               SELECT 1
               FROM family_children fc
               WHERE fc.id = family_child_states.child_id
                 AND fc.family_id = ?
             )`,
        )
        .bind(
          JSON.stringify(state),
          childId,
          expectedVersion,
          familyId,
        )
        .run();
      if (!update.meta?.changes) return null;
      return this.getFamilyChildState(familyId, childId);
    },
    async deleteFamilyChild(familyId, childId) {
      const deletion = await db
        .prepare(
          `DELETE FROM family_children
           WHERE id = ? AND family_id = ?`,
        )
        .bind(childId, familyId)
        .run();
      return Number(deletion.meta?.changes) > 0;
    },
    async revokeFamily(familyId) {
      await db.batch([
        db
          .prepare(
            `DELETE FROM family_child_states
             WHERE child_id IN (
               SELECT id FROM family_children WHERE family_id = ?
             )`,
          )
          .bind(familyId),
        db
          .prepare(
            `DELETE FROM family_children WHERE family_id = ?`,
          )
          .bind(familyId),
        db
          .prepare(
            `DELETE FROM family_sessions WHERE family_id = ?`,
          )
          .bind(familyId),
        db
          .prepare(
            `DELETE FROM family_passports WHERE id = ?`,
          )
          .bind(familyId),
      ]);
    },
    async getPublishedDaily(topicDate) {
      const statement = db
        .prepare(
          `SELECT
             rp.id,
             rp.content_key,
             fp.topic_date,
             fp.category,
             rp.difficulty,
             rp.reading_level,
             rp.support_mode,
             rp.text_type,
             rp.title,
             rp.hook_question,
             rp.reading_minutes,
             rp.glossary_json,
             rp.source_attribution_json,
             rp.version
           FROM reading_packages rp
           JOIN fact_packs fp ON fp.id = rp.fact_pack_id
           WHERE rp.publication_status = 'published'
             AND fp.topic_date = ?
           ORDER BY
             CASE fp.category
               WHEN 'world' THEN 1
               WHEN 'science' THEN 2
               ELSE 3
             END,
             CASE rp.difficulty
               WHEN 'guided' THEN 1
               ELSE 2
             END`,
        )
        .bind(topicDate);
      const { results = [] } = await statement.all();
      return results.map(mapPublishedReading);
    },
    async getLatestPublishedDaily(topicDate) {
      const statement = db
        .prepare(
          `SELECT
             rp.id,
             rp.content_key,
             fp.topic_date,
             fp.category,
             rp.difficulty,
             rp.reading_level,
             rp.support_mode,
             rp.text_type,
             rp.title,
             rp.hook_question,
             rp.reading_minutes,
             rp.glossary_json,
             rp.source_attribution_json,
             rp.version
           FROM reading_packages rp
           JOIN fact_packs fp ON fp.id = rp.fact_pack_id
           WHERE rp.publication_status = 'published'
             AND fp.topic_date = (
               SELECT MAX(fp2.topic_date)
               FROM reading_packages rp2
               JOIN fact_packs fp2 ON fp2.id = rp2.fact_pack_id
               WHERE rp2.publication_status = 'published'
                 AND fp2.topic_date <= ?
                 AND fp2.topic_date >= date(?, '-7 days')
             )
           ORDER BY
             CASE fp.category
               WHEN 'world' THEN 1
               WHEN 'science' THEN 2
               ELSE 3
             END,
             CASE rp.difficulty
               WHEN 'guided' THEN 1
               ELSE 2
             END`,
        )
        .bind(topicDate, topicDate);
      const { results = [] } = await statement.all();
      return results.map(mapPublishedReading);
    },
    async getPublishedReading(id) {
      const row = await db
        .prepare(
          `SELECT
             rp.id,
             rp.content_key,
             fp.category,
             rp.difficulty,
             rp.text_type,
             rp.title,
             rp.hook_question,
             rp.body,
             rp.glossary_json,
             rp.reading_strategy_json,
             rp.source_attribution_json,
             rp.reading_minutes,
             rp.version
           FROM reading_packages rp
           JOIN fact_packs fp ON fp.id = rp.fact_pack_id
           WHERE rp.id = ?
             AND rp.publication_status = 'published'
           LIMIT 1`,
        )
        .bind(id)
        .first();
      if (!row) return null;

      const assessmentStatement = db
        .prepare(
          `SELECT
             id,
             item_type,
             prompt,
             options_json,
             correct_answer,
             rationale,
             distractor_reasons_json,
             evidence_span_json
           FROM assessment_items
           WHERE reading_package_id = ?
           ORDER BY
             CASE item_type
               WHEN 'comprehension' THEN 1
               WHEN 'inference' THEN 2
               ELSE 3
             END`,
        )
        .bind(id);
      const { results: assessmentRows = [] } = await assessmentStatement.all();

      return {
        id: row.id,
        contentKey: row.content_key,
        category: row.category,
        difficulty: row.difficulty,
        level: row.reading_level ?? "tower",
        supportMode:
          row.support_mode ??
          (row.difficulty === "guided" ? "guided" : "independent"),
        textType: row.text_type,
        title: row.title,
        hookQuestion: row.hook_question,
        body: parseJsonField(row.body, "body"),
        glossary: parseJsonField(row.glossary_json, "glossary_json"),
        readingStrategy: parseJsonField(
          row.reading_strategy_json,
          "reading_strategy_json",
        ),
        sourceAttribution: parseJsonField(
          row.source_attribution_json,
          "source_attribution_json",
        ),
        readingMinutes: row.reading_minutes,
        version: row.version,
        assessment: assessmentRows.map(mapAssessmentItem),
      };
    },
    async getAssessmentKey(readingId, version) {
      const statement = db
        .prepare(
          `SELECT
             ai.id,
             ai.correct_answer,
             ai.rationale,
             ai.distractor_reasons_json,
             ai.evidence_span_json
           FROM assessment_items ai
           JOIN reading_packages rp ON rp.id = ai.reading_package_id
           WHERE ai.reading_package_id = ?
             AND rp.version = ?
             AND rp.publication_status = 'published'
             AND ai.version = (
               SELECT MAX(ai2.version)
               FROM assessment_items ai2
               WHERE ai2.reading_package_id = ai.reading_package_id
                 AND ai2.item_type = ai.item_type
             )
           ORDER BY
             CASE ai.item_type
               WHEN 'comprehension' THEN 1
               WHEN 'inference' THEN 2
               ELSE 3
             END`,
        )
        .bind(readingId, version);
      const { results = [] } = await statement.all();
      if (results.length === 0) return null;
      return results.map((row) => ({
        id: row.id,
        correctAnswer: row.correct_answer,
        rationale: row.rationale,
        distractorReasons: parseJsonField(
          row.distractor_reasons_json,
          "distractor_reasons_json",
        ),
        evidenceSpan: parseJsonField(
          row.evidence_span_json,
          "evidence_span_json",
        ),
      }));
    },
  });
}
