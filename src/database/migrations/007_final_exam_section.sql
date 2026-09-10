ALTER TABLE course_sections
  ADD COLUMN IF NOT EXISTS is_final_exam BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_course_sections_final_exam
  ON course_sections (course_id)
  WHERE is_final_exam = true;
