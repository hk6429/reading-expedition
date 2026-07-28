function json(value) {
  return JSON.stringify(value);
}

export async function seedReadingPackage(db, fixture) {
  if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function") {
    throw new TypeError("A D1-compatible database is required");
  }
  if (!fixture?.contentKey || !Array.isArray(fixture.packages)) {
    throw new TypeError("A complete seed fixture is required");
  }

  const statements = [
    db
      .prepare(
        `INSERT OR IGNORE INTO sources (
           id, name, base_url, license_type, license_version,
           allowed_usage, status, last_checked_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
      )
      .bind(
        fixture.source.id,
        fixture.source.name,
        fixture.source.baseUrl,
        fixture.source.licenseType,
        fixture.source.licenseVersion,
        fixture.source.allowedUsage,
        fixture.sourceItem.fetchedAt,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO source_items (
           id, source_id, canonical_url, title, publisher, published_at,
           fetched_at, content_fingerprint, license_snapshot, extract_scope
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        fixture.sourceItem.id,
        fixture.source.id,
        fixture.sourceItem.canonicalUrl,
        fixture.sourceItem.title,
        fixture.sourceItem.publisher,
        fixture.sourceItem.publishedAt,
        fixture.sourceItem.fetchedAt,
        fixture.sourceItem.contentFingerprint,
        fixture.sourceItem.licenseSnapshot,
        fixture.sourceItem.extractScope,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO fact_packs (
           id, topic_date, category, facts_json, source_links_json,
           sensitivity_flags_json, verification_status, version
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        fixture.factPack.id,
        fixture.factPack.topicDate,
        fixture.factPack.category,
        json(fixture.factPack.facts),
        json(fixture.factPack.sourceLinks),
        json(fixture.factPack.sensitivityFlags),
        fixture.factPack.verificationStatus,
        fixture.factPack.version,
      ),
  ];

  let assessmentItems = 0;
  for (const reading of fixture.packages) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO reading_packages (
             id, content_key, fact_pack_id, difficulty, text_type, title, hook_question,
             body, glossary_json, reading_minutes, source_attribution_json,
             quality_score, hard_gate_status, publication_status, version,
             published_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          reading.id,
          fixture.contentKey,
          fixture.factPack.id,
          reading.difficulty,
          reading.textType ?? "vernacular",
          reading.title,
          reading.hookQuestion,
          json(reading.body),
          json(reading.glossary),
          reading.readingMinutes,
          json(reading.sourceAttribution),
          reading.qualityScore,
          reading.hardGateStatus,
          reading.publicationStatus,
          reading.version,
          fixture.sourceItem.fetchedAt,
        ),
    );

    for (const item of reading.assessment) {
      assessmentItems += 1;
      statements.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO assessment_items (
               id, reading_package_id, item_type, prompt, options_json,
               correct_answer, rationale, distractor_reasons_json,
               evidence_span_json, version
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            item.id,
            reading.id,
            item.type,
            item.prompt,
            json(item.options),
            item.correctAnswer,
            item.rationale,
            json(item.distractorReasons),
            json(item.evidenceSpan),
            reading.version,
          ),
      );
    }
  }

  await db.batch(statements);
  return {
    contentKey: fixture.contentKey,
    packages: fixture.packages.length,
    assessmentItems,
  };
}
