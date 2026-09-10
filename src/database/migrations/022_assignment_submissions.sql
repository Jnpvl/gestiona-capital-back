-- Bloque de tarea (entrega del alumno)
DO $$ BEGIN
  ALTER TYPE lesson_block_type ADD VALUE 'assignment';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL DEFAULT 1,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  student_comment TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'returned')),
  reviewer_comment TEXT,
  reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_enrollment_block
  ON assignment_submissions (enrollment_id, block_id, attempt_number DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status
  ON assignment_submissions (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_block
  ON assignment_submissions (block_id);
