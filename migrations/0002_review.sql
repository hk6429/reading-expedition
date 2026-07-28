PRAGMA foreign_keys = ON;

CREATE TABLE teacher_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE review_events (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES reading_packages(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('created', 'edited', 'returned', 'approved', 'published', 'withdrawn', 'archived')),
  reason_code TEXT,
  note TEXT,
  before_hash TEXT,
  after_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX review_events_package_idx ON review_events(package_id, created_at);

CREATE TRIGGER review_events_no_update
BEFORE UPDATE ON review_events
BEGIN
  SELECT RAISE(ABORT, 'review events are append-only');
END;
CREATE TRIGGER review_events_no_delete
BEFORE DELETE ON review_events
BEGIN
  SELECT RAISE(ABORT, 'review events are append-only');
END;
