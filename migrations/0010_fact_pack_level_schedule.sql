-- D1 migrations run inside an implicit transaction and cannot disable foreign
-- keys. Defer validation while rebuilding the parent table, then restore it.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE fact_packs_with_level (
  id TEXT PRIMARY KEY,
  topic_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('world', 'science', 'humanities')),
  reading_level TEXT NOT NULL DEFAULT 'tower'
    CHECK (reading_level IN ('launch', 'voyage', 'tower')),
  facts_json TEXT NOT NULL,
  source_links_json TEXT NOT NULL,
  sensitivity_flags_json TEXT NOT NULL DEFAULT '[]',
  verification_status TEXT NOT NULL
    CHECK (verification_status IN ('pending', 'verified', 'conflicted', 'rejected')),
  version INTEGER NOT NULL CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (topic_date, category, reading_level, version)
);

INSERT INTO fact_packs_with_level (
  id, topic_date, category, reading_level, facts_json, source_links_json,
  sensitivity_flags_json, verification_status, version, created_at
)
SELECT
  id, topic_date, category, 'tower', facts_json, source_links_json,
  sensitivity_flags_json, verification_status, version, created_at
FROM fact_packs;

DROP TABLE fact_packs;
ALTER TABLE fact_packs_with_level RENAME TO fact_packs;

PRAGMA defer_foreign_keys = OFF;
