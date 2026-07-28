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

export function createReadingRepository(db) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("A D1-compatible database is required");
  }

  return Object.freeze({
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
  });
}
