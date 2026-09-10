ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS enrolled_via_company BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS dc3_template_url VARCHAR(500);

ALTER TABLE enrollment_progress
  ADD COLUMN IF NOT EXISTS dc3_certificate_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS dc3_certificate_issued_at TIMESTAMPTZ;
