PRAGMA foreign_keys = ON;

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL UNIQUE,
  license_type TEXT NOT NULL,
  license_version TEXT,
  allowed_usage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'blocked')),
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE source_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  canonical_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  content_fingerprint TEXT NOT NULL,
  license_snapshot TEXT NOT NULL,
  extract_scope TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX source_items_source_id_idx ON source_items(source_id);
CREATE INDEX source_items_fingerprint_idx ON source_items(content_fingerprint);

CREATE TABLE fact_packs (
  id TEXT PRIMARY KEY,
  topic_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('world', 'science', 'humanities')),
  facts_json TEXT NOT NULL,
  source_links_json TEXT NOT NULL,
  sensitivity_flags_json TEXT NOT NULL DEFAULT '[]',
  verification_status TEXT NOT NULL
    CHECK (verification_status IN ('pending', 'verified', 'conflicted', 'rejected')),
  version INTEGER NOT NULL CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (topic_date, category, version)
);

CREATE TABLE reading_packages (
  id TEXT PRIMARY KEY,
  content_key TEXT NOT NULL,
  fact_pack_id TEXT NOT NULL REFERENCES fact_packs(id),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('guided', 'challenge')),
  title TEXT NOT NULL,
  hook_question TEXT NOT NULL,
  body TEXT NOT NULL,
  glossary_json TEXT NOT NULL DEFAULT '[]',
  reading_minutes INTEGER NOT NULL CHECK (reading_minutes BETWEEN 1 AND 30),
  source_attribution_json TEXT NOT NULL,
  quality_score INTEGER NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  hard_gate_status TEXT NOT NULL CHECK (hard_gate_status IN ('pending', 'passed', 'failed')),
  publication_status TEXT NOT NULL
    CHECK (publication_status IN ('draft', 'review', 'published', 'withdrawn', 'archived')),
  version INTEGER NOT NULL CHECK (version >= 1),
  published_at TEXT,
  withdrawn_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (content_key, difficulty, version)
);

CREATE INDEX reading_packages_daily_idx
  ON reading_packages(publication_status, content_key, difficulty);

CREATE TABLE assessment_items (
  id TEXT PRIMARY KEY,
  reading_package_id TEXT NOT NULL REFERENCES reading_packages(id),
  item_type TEXT NOT NULL CHECK (item_type IN ('comprehension', 'inference', 'evidence')),
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  rationale TEXT NOT NULL,
  distractor_reasons_json TEXT NOT NULL,
  evidence_span_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (reading_package_id, item_type, version)
);

CREATE TABLE pipeline_runs (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 2),
  trace_id TEXT NOT NULL,
  error_code TEXT,
  error_summary TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);
