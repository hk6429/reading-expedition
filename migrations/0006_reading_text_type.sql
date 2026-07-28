ALTER TABLE reading_packages
ADD COLUMN text_type TEXT NOT NULL DEFAULT 'vernacular'
CHECK (text_type IN ('vernacular', 'classical'));

