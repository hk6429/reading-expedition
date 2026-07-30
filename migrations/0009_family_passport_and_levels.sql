PRAGMA foreign_keys = ON;

ALTER TABLE reading_packages
ADD COLUMN reading_level TEXT NOT NULL DEFAULT 'tower'
CHECK (reading_level IN ('launch', 'voyage', 'tower'));

ALTER TABLE reading_packages
ADD COLUMN support_mode TEXT NOT NULL DEFAULT 'independent'
CHECK (support_mode IN ('guided', 'independent'));

UPDATE reading_packages
SET support_mode = CASE difficulty
  WHEN 'guided' THEN 'guided'
  ELSE 'independent'
END;

CREATE INDEX reading_packages_level_mode_idx
  ON reading_packages(publication_status, reading_level, support_mode);

CREATE TABLE family_passports (
  id TEXT PRIMARY KEY,
  passport_code_hash TEXT NOT NULL UNIQUE,
  time_zone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);

CREATE TABLE family_sessions (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_passports(id),
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX family_sessions_lookup_idx
  ON family_sessions(token_hash, expires_at);

CREATE TABLE family_children (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_passports(id),
  alias TEXT NOT NULL CHECK (length(alias) BETWEEN 1 AND 12),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX family_children_family_idx
  ON family_children(family_id, created_at);

CREATE TABLE family_child_states (
  child_id TEXT PRIMARY KEY REFERENCES family_children(id) ON DELETE CASCADE,
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
