PRAGMA foreign_keys = ON;

ALTER TABLE classroom_tokens ADD COLUMN seat_hash TEXT;
CREATE UNIQUE INDEX classroom_tokens_seat_idx
  ON classroom_tokens(classroom_id, seat_hash)
  WHERE seat_hash IS NOT NULL;

ALTER TABLE classroom_contributions ADD COLUMN quality_revision_opportunities INTEGER
  CHECK (quality_revision_opportunities BETWEEN 0 AND 3);
ALTER TABLE classroom_contributions ADD COLUMN comprehension_opportunities INTEGER
  CHECK (comprehension_opportunities BETWEEN 0 AND 3);
ALTER TABLE classroom_contributions ADD COLUMN comprehension_first_correct INTEGER
  CHECK (comprehension_first_correct BETWEEN 0 AND 3);
ALTER TABLE classroom_contributions ADD COLUMN inference_opportunities INTEGER
  CHECK (inference_opportunities BETWEEN 0 AND 3);
ALTER TABLE classroom_contributions ADD COLUMN inference_first_correct INTEGER
  CHECK (inference_first_correct BETWEEN 0 AND 3);
ALTER TABLE classroom_contributions ADD COLUMN evidence_opportunities INTEGER
  CHECK (evidence_opportunities BETWEEN 0 AND 3);
ALTER TABLE classroom_contributions ADD COLUMN evidence_first_correct INTEGER
  CHECK (evidence_first_correct BETWEEN 0 AND 3);

ALTER TABLE family_children ADD COLUMN alias_key TEXT;
UPDATE family_children
SET alias_key = lower(trim(alias))
WHERE id IN (
  SELECT MIN(id)
  FROM family_children
  GROUP BY family_id, lower(trim(alias))
);
UPDATE family_children
SET alias_key = lower(trim(alias)) || '#legacy#' || id
WHERE alias_key IS NULL;
CREATE UNIQUE INDEX family_children_alias_key_idx
  ON family_children(family_id, alias_key);
