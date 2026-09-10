ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS certificate_template_url VARCHAR(500);

ALTER TABLE block_progress
  ADD COLUMN IF NOT EXISTS passed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE enrollment_progress
  ADD COLUMN IF NOT EXISTS certificate_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS certificate_issued_at TIMESTAMPTZ;
