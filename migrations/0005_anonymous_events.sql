PRAGMA foreign_keys = ON;

CREATE TABLE anonymous_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'reading_opened',
      'reading_completed',
      'assessment_submitted',
      'evidence_located',
      'answer_revised',
      'city_invested',
      'return_visit',
      'chapter_reviewed'
    )
  ),
  occurred_at TEXT NOT NULL,
  content_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('world', 'science', 'humanities')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('guided', 'challenge')),
  duration_bucket TEXT NOT NULL CHECK (
    duration_bucket IN ('under-1m', '1-5m', '6-10m', 'over-10m')
  ),
  anonymous_device_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX anonymous_events_metrics_idx
  ON anonymous_events(event_type, occurred_at, category, difficulty);
