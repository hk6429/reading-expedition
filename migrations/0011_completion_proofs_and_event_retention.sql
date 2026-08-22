ALTER TABLE classroom_contributions ADD COLUMN canonical_content_key TEXT;
ALTER TABLE classroom_contributions ADD COLUMN reading_version INTEGER;
ALTER TABLE classroom_contributions ADD COLUMN proof_nonce TEXT;

CREATE UNIQUE INDEX classroom_contributions_canonical_once_idx
  ON classroom_contributions(classroom_id, participant_id, canonical_content_key)
  WHERE canonical_content_key IS NOT NULL;

CREATE UNIQUE INDEX classroom_contributions_proof_nonce_once_idx
  ON classroom_contributions(proof_nonce)
  WHERE proof_nonce IS NOT NULL;

CREATE INDEX anonymous_events_created_at_idx
  ON anonymous_events(created_at);
