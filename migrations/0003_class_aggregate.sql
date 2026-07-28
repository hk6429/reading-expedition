PRAGMA foreign_keys = ON;

CREATE TABLE class_aggregates (
  class_code_hash TEXT NOT NULL,
  period TEXT NOT NULL,
  anonymous_participants INTEGER NOT NULL DEFAULT 0 CHECK (anonymous_participants >= 0),
  valid_readings INTEGER NOT NULL DEFAULT 0 CHECK (valid_readings >= 0),
  category_distribution_json TEXT NOT NULL DEFAULT '{}',
  skill_distribution_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (class_code_hash, period)
);
