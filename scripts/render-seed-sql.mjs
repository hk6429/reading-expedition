import fs from "node:fs";

const fixture = JSON.parse(
  fs.readFileSync(
    new URL("../test/fixtures/seed-reading-package.json", import.meta.url),
    "utf8",
  ),
);

const value = (input) =>
  input === null || input === undefined
    ? "NULL"
    : `'${String(input).replaceAll("'", "''")}'`;
const json = (input) => value(JSON.stringify(input));
const rows = [];

rows.push(`INSERT OR IGNORE INTO sources (
  id, name, base_url, license_type, license_version, allowed_usage, status, last_checked_at
) VALUES (
  ${value(fixture.source.id)}, ${value(fixture.source.name)}, ${value(fixture.source.baseUrl)},
  ${value(fixture.source.licenseType)}, ${value(fixture.source.licenseVersion)},
  ${value(fixture.source.allowedUsage)}, 'active', ${value(fixture.sourceItem.fetchedAt)}
);`);
rows.push(`INSERT OR IGNORE INTO source_items (
  id, source_id, canonical_url, title, publisher, published_at, fetched_at,
  content_fingerprint, license_snapshot, extract_scope
) VALUES (
  ${value(fixture.sourceItem.id)}, ${value(fixture.source.id)},
  ${value(fixture.sourceItem.canonicalUrl)}, ${value(fixture.sourceItem.title)},
  ${value(fixture.sourceItem.publisher)}, ${value(fixture.sourceItem.publishedAt)},
  ${value(fixture.sourceItem.fetchedAt)}, ${value(fixture.sourceItem.contentFingerprint)},
  ${value(fixture.sourceItem.licenseSnapshot)}, ${value(fixture.sourceItem.extractScope)}
);`);
rows.push(`INSERT OR IGNORE INTO fact_packs (
  id, topic_date, category, facts_json, source_links_json,
  sensitivity_flags_json, verification_status, version
) VALUES (
  ${value(fixture.factPack.id)}, ${value(fixture.factPack.topicDate)},
  ${value(fixture.factPack.category)}, ${json(fixture.factPack.facts)},
  ${json(fixture.factPack.sourceLinks)}, ${json(fixture.factPack.sensitivityFlags)},
  ${value(fixture.factPack.verificationStatus)}, ${fixture.factPack.version}
);`);

for (const reading of fixture.packages) {
  rows.push(`INSERT OR IGNORE INTO reading_packages (
    id, content_key, fact_pack_id, difficulty, title, hook_question, body,
    glossary_json, reading_minutes, source_attribution_json, quality_score,
    hard_gate_status, publication_status, version, published_at
  ) VALUES (
    ${value(reading.id)}, ${value(fixture.contentKey)}, ${value(fixture.factPack.id)},
    ${value(reading.difficulty)}, ${value(reading.title)}, ${value(reading.hookQuestion)},
    ${json(reading.body)}, ${json(reading.glossary)}, ${reading.readingMinutes},
    ${json(reading.sourceAttribution)}, ${reading.qualityScore},
    ${value(reading.hardGateStatus)}, ${value(reading.publicationStatus)},
    ${reading.version}, ${value(fixture.sourceItem.fetchedAt)}
  );`);
  for (const item of reading.assessment) {
    rows.push(`INSERT OR IGNORE INTO assessment_items (
      id, reading_package_id, item_type, prompt, options_json, correct_answer,
      rationale, distractor_reasons_json, evidence_span_json, version
    ) VALUES (
      ${value(item.id)}, ${value(reading.id)}, ${value(item.type)}, ${value(item.prompt)},
      ${json(item.options)}, ${value(item.correctAnswer)}, ${value(item.rationale)},
      ${json(item.distractorReasons)}, ${json(item.evidenceSpan)}, ${reading.version}
    );`);
  }
}

process.stdout.write(`${rows.join("\n")}\n`);
