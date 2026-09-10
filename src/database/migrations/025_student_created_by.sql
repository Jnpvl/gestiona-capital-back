ALTER TABLE students
  ADD COLUMN IF NOT EXISTS created_by_staff_id UUID NULL REFERENCES staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_created_by_staff_id
  ON students (created_by_staff_id);
