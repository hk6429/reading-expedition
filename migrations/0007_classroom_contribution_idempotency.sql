ALTER TABLE classroom_contributions ADD COLUMN content_id TEXT;

CREATE UNIQUE INDEX classroom_contributions_once_idx
  ON classroom_contributions(classroom_id, participant_id, content_id)
  WHERE content_id IS NOT NULL;
