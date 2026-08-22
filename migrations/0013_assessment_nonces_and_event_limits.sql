CREATE TABLE assessment_start_nonces (
  nonce TEXT PRIMARY KEY,
  reading_id TEXT NOT NULL,
  content_key TEXT NOT NULL,
  reading_version INTEGER NOT NULL CHECK (reading_version > 0),
  category TEXT NOT NULL CHECK (category IN ('world', 'science', 'humanities')),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX assessment_start_nonces_expiry_idx
  ON assessment_start_nonces(expires_at);

CREATE INDEX anonymous_events_device_created_idx
  ON anonymous_events(anonymous_device_id, created_at);
