PRAGMA foreign_keys = ON;

CREATE TABLE class_missions (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id),
  period TEXT NOT NULL,
  mission_type TEXT NOT NULL CHECK (
    mission_type IN ('shared_readings', 'category_balance', 'ability_practice')
  ),
  target INTEGER NOT NULL CHECK (target BETWEEN 0 AND 500),
  created_by_session TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (classroom_id, period)
);

CREATE INDEX class_missions_period_idx
  ON class_missions(period, classroom_id);

CREATE TABLE class_mission_votes (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id),
  participant_id TEXT NOT NULL REFERENCES classroom_tokens(id),
  period TEXT NOT NULL,
  choice TEXT NOT NULL CHECK (
    choice IN ('shared_readings', 'category_balance', 'ability_practice')
  ),
  created_at TEXT NOT NULL,
  UNIQUE (classroom_id, participant_id, period)
);

CREATE INDEX class_mission_votes_aggregate_idx
  ON class_mission_votes(classroom_id, period, choice);

CREATE TABLE class_mission_exits (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id),
  participant_id TEXT NOT NULL REFERENCES classroom_tokens(id),
  period TEXT NOT NULL,
  exit_code TEXT NOT NULL CHECK (
    exit_code IN ('found_evidence', 'changed_view', 'need_support')
  ),
  updated_at TEXT NOT NULL,
  UNIQUE (classroom_id, participant_id, period)
);

CREATE INDEX class_mission_exits_aggregate_idx
  ON class_mission_exits(classroom_id, period, exit_code);

CREATE TABLE class_assignments (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id) UNIQUE,
  reading_id TEXT NOT NULL,
  title TEXT NOT NULL,
  ability TEXT NOT NULL CHECK (
    ability IN ('comprehension', 'inference', 'evidence')
  ),
  route TEXT NOT NULL CHECK (
    route IN ('guided', 'independent', 'equivalent')
  ),
  due_date TEXT,
  created_by_session TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE classroom_contributions ADD COLUMN quality_first_correct INTEGER
  CHECK (quality_first_correct BETWEEN 0 AND 3);
ALTER TABLE classroom_contributions ADD COLUMN quality_revised_correct INTEGER
  CHECK (quality_revised_correct BETWEEN 0 AND 3);
ALTER TABLE classroom_contributions ADD COLUMN quality_evidence_viewed INTEGER
  CHECK (quality_evidence_viewed IN (0, 1));
ALTER TABLE classroom_contributions ADD COLUMN quality_transfer_completed INTEGER
  CHECK (quality_transfer_completed IN (0, 1));
