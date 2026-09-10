ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS workers_count INTEGER,
  ADD COLUMN IF NOT EXISTS employer_representative VARCHAR(255),
  ADD COLUMN IF NOT EXISTS workers_representative VARCHAR(255),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE companies SET updated_at = created_at WHERE updated_at IS NULL;
