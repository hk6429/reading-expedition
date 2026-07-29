import fs from "node:fs";
import path from "node:path";

const cliArgs = process.argv.slice(2);
const outputIndex = cliArgs.indexOf("--output");
const outputFile =
  outputIndex >= 0 && cliArgs[outputIndex + 1]
    ? path.resolve(cliArgs[outputIndex + 1])
    : null;
const cliFiles = cliArgs.filter(
  (_argument, index) =>
    outputIndex < 0 ||
    (index !== outputIndex && index !== outputIndex + 1),
);
const fixtures =
  cliFiles.length > 0
    ? cliFiles.map((file) =>
        JSON.parse(fs.readFileSync(path.resolve(file), "utf8")),
      )
    : [
        "seed-reading-package.json",
        "seed-science-reading-package.json",
        "seed-humanities-reading-package.json",
      ].map((file) =>
        JSON.parse(
          fs.readFileSync(
            new URL(`../test/fixtures/${file}`, import.meta.url),
            "utf8",
          ),
        ),
      );

const value = (input) =>
  input === null || input === undefined
    ? "NULL"
    : `'${String(input).replaceAll("'", "''")}'`;
const json = (input) => value(JSON.stringify(input));
const rows = [];

for (const fixture of fixtures) {
  rows.push(`INSERT OR IGNORE INTO sources (
  id, name, base_url, license_type, license_version, allowed_usage, status, last_checked_at
) VALUES (
  ${value(fixture.source.id)}, ${value(fixture.source.name)}, ${value(fixture.source.baseUrl)},
  ${value(fixture.source.licenseType)}, ${value(fixture.source.licenseVersion)},
  ${value(fixture.source.allowedUsage)}, 'active', ${value(fixture.sourceItem.fetchedAt)}
);`);
  rows.push(`UPDATE sources SET
  name = ${value(fixture.source.name)},
  base_url = ${value(fixture.source.baseUrl)},
  license_type = ${value(fixture.source.licenseType)},
  license_version = ${value(fixture.source.licenseVersion)},
  allowed_usage = ${value(fixture.source.allowedUsage)},
  status = 'active',
  last_checked_at = ${value(fixture.sourceItem.fetchedAt)}
WHERE base_url = ${value(fixture.source.baseUrl)};`);
rows.push(`INSERT OR IGNORE INTO source_items (
  id, source_id, canonical_url, title, publisher, published_at, fetched_at,
  content_fingerprint, license_snapshot, extract_scope
) VALUES (
  ${value(fixture.sourceItem.id)},
  (SELECT id FROM sources WHERE base_url = ${value(fixture.source.baseUrl)}),
  ${value(fixture.sourceItem.canonicalUrl)}, ${value(fixture.sourceItem.title)},
  ${value(fixture.sourceItem.publisher)}, ${value(fixture.sourceItem.publishedAt)},
  ${value(fixture.sourceItem.fetchedAt)}, ${value(fixture.sourceItem.contentFingerprint)},
  ${value(fixture.sourceItem.licenseSnapshot)}, ${value(fixture.sourceItem.extractScope)}
);`);
  rows.push(`UPDATE source_items SET
  canonical_url = ${value(fixture.sourceItem.canonicalUrl)},
  title = ${value(fixture.sourceItem.title)},
  publisher = ${value(fixture.sourceItem.publisher)},
  published_at = ${value(fixture.sourceItem.publishedAt)},
  fetched_at = ${value(fixture.sourceItem.fetchedAt)},
  content_fingerprint = ${value(fixture.sourceItem.contentFingerprint)},
  license_snapshot = ${value(fixture.sourceItem.licenseSnapshot)},
  extract_scope = ${value(fixture.sourceItem.extractScope)},
  source_id = (
    SELECT id FROM sources WHERE base_url = ${value(fixture.source.baseUrl)}
  )
WHERE id = ${value(fixture.sourceItem.id)};`);
rows.push(`INSERT OR IGNORE INTO fact_packs (
  id, topic_date, category, facts_json, source_links_json,
  sensitivity_flags_json, verification_status, version
) VALUES (
  ${value(fixture.factPack.id)}, ${value(fixture.factPack.topicDate)},
  ${value(fixture.factPack.category)}, ${json(fixture.factPack.facts)},
  ${json(fixture.factPack.sourceLinks)}, ${json(fixture.factPack.sensitivityFlags)},
  ${value(fixture.factPack.verificationStatus)}, ${fixture.factPack.version}
);`);
  rows.push(`UPDATE fact_packs SET
  topic_date = ${value(fixture.factPack.topicDate)},
  category = ${value(fixture.factPack.category)},
  facts_json = ${json(fixture.factPack.facts)},
  source_links_json = ${json(fixture.factPack.sourceLinks)},
  sensitivity_flags_json = ${json(fixture.factPack.sensitivityFlags)},
  verification_status = ${value(fixture.factPack.verificationStatus)}
WHERE id = ${value(fixture.factPack.id)};`);

  for (const reading of fixture.packages) {
    const publicationStatus =
      reading.publicationStatus === "manual_review"
        ? "review"
        : reading.publicationStatus;
    const publishedAt =
      publicationStatus === "published"
        ? fixture.sourceItem.fetchedAt
        : null;
    rows.push(`INSERT OR IGNORE INTO reading_packages (
    id, content_key, fact_pack_id, difficulty, text_type, title, hook_question, body,
    glossary_json, reading_strategy_json, reading_minutes, source_attribution_json, quality_score,
    hard_gate_status, publication_status, version, published_at
  ) VALUES (
    ${value(reading.id)}, ${value(fixture.contentKey)}, ${value(fixture.factPack.id)},
    ${value(reading.difficulty)}, ${value(reading.textType)}, ${value(reading.title)}, ${value(reading.hookQuestion)},
    ${json(reading.body)}, ${json(reading.glossary)}, ${json(reading.readingStrategy ?? {})}, ${reading.readingMinutes},
    ${json(reading.sourceAttribution)}, ${reading.qualityScore},
    ${value(reading.hardGateStatus)}, ${value(publicationStatus)},
    ${reading.version}, ${value(publishedAt)}
  );`);
    rows.push(`UPDATE reading_packages SET
    text_type = ${value(reading.textType)},
    title = ${value(reading.title)},
    hook_question = ${value(reading.hookQuestion)},
    body = ${json(reading.body)},
    glossary_json = ${json(reading.glossary)},
    reading_strategy_json = ${json(reading.readingStrategy ?? {})},
    reading_minutes = ${reading.readingMinutes},
    source_attribution_json = ${json(reading.sourceAttribution)},
    quality_score = ${reading.qualityScore},
    hard_gate_status = ${value(reading.hardGateStatus)},
    publication_status = ${value(publicationStatus)},
    published_at = ${value(publishedAt)}
  WHERE id = ${value(reading.id)};`);
    for (const item of reading.assessment) {
      rows.push(`INSERT OR IGNORE INTO assessment_items (
      id, reading_package_id, item_type, prompt, options_json, correct_answer,
      rationale, distractor_reasons_json, evidence_span_json, version
    ) VALUES (
      ${value(item.id)}, ${value(reading.id)}, ${value(item.type)}, ${value(item.prompt)},
      ${json(item.options)}, ${value(item.correctAnswer)}, ${value(item.rationale)},
      ${json(item.distractorReasons)}, ${json(item.evidenceSpan)}, ${reading.version}
      );`);
      rows.push(`UPDATE assessment_items SET
      item_type = ${value(item.type)},
      prompt = ${value(item.prompt)},
      options_json = ${json(item.options)},
      correct_answer = ${value(item.correctAnswer)},
      rationale = ${value(item.rationale)},
      distractor_reasons_json = ${json(item.distractorReasons)},
      evidence_span_json = ${json(item.evidenceSpan)}
    WHERE id = ${value(item.id)};`);
    }
  }
}

const sql = `${rows.join("\n")}\n`;
if (outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, sql);
} else {
  process.stdout.write(sql);
}
