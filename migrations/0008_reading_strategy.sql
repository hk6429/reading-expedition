ALTER TABLE reading_packages
ADD COLUMN reading_strategy_json TEXT NOT NULL DEFAULT '{}';
