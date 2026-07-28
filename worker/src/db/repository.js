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
    category: row.category,
    difficulty: row.difficulty,
    title: row.title,
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
    title: row.title,
    hookQuestion: row.hook_question,
    body: parseJsonField(row.body, "body"),
    glossary: parseJsonField(row.glossary_json, "glossary_json"),
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
    async listReviewPackages(status) {
      const statement = db
        .prepare(
          `SELECT
             rp.id,
             rp.content_key,
             fp.category,
             rp.difficulty,
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
    async getPublishedDaily(topicDate) {
      const statement = db
        .prepare(
          `SELECT
             rp.id,
             rp.content_key,
             fp.category,
             rp.difficulty,
             rp.title,
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
    async getPublishedReading(id) {
      const row = await db
        .prepare(
          `SELECT
             rp.id,
             rp.content_key,
             fp.category,
             rp.difficulty,
             rp.title,
             rp.body,
             rp.glossary_json,
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
        title: row.title,
        body: parseJsonField(row.body, "body"),
        glossary: parseJsonField(row.glossary_json, "glossary_json"),
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
             ai.evidence_span_json
           FROM assessment_items ai
           JOIN reading_packages rp ON rp.id = ai.reading_package_id
           WHERE ai.reading_package_id = ?
             AND ai.version = ?
             AND rp.version = ?
             AND rp.publication_status = 'published'
           ORDER BY
             CASE ai.item_type
               WHEN 'comprehension' THEN 1
               WHEN 'inference' THEN 2
               ELSE 3
             END`,
        )
        .bind(readingId, version, version);
      const { results = [] } = await statement.all();
      if (results.length === 0) return null;
      return results.map((row) => ({
        id: row.id,
        correctAnswer: row.correct_answer,
        rationale: row.rationale,
        evidenceSpan: parseJsonField(
          row.evidence_span_json,
          "evidence_span_json",
        ),
      }));
    },
  });
}
