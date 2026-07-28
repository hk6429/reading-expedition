PRAGMA foreign_keys = ON;

CREATE TABLE classrooms (
  id TEXT PRIMARY KEY,
  class_code_hash TEXT NOT NULL UNIQUE,
  created_by_session TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE classroom_tokens (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX classroom_tokens_classroom_idx
  ON classroom_tokens(classroom_id, expires_at);

CREATE TABLE classroom_contributions (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id),
  participant_id TEXT NOT NULL REFERENCES classroom_tokens(id),
  category TEXT NOT NULL CHECK (category IN ('world', 'science', 'humanities')),
  skill TEXT NOT NULL CHECK (skill IN ('comprehension', 'inference', 'evidence')),
  period TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX classroom_contributions_aggregate_idx
  ON classroom_contributions(classroom_id, period, category, skill);
