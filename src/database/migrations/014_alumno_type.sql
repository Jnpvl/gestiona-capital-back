ALTER TABLE students
  ADD COLUMN IF NOT EXISTS alumno_type VARCHAR(20) NOT NULL DEFAULT 'particular';

UPDATE students
SET alumno_type = 'trabajador'
WHERE company_id IS NOT NULL;

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_alumno_type_check;

ALTER TABLE students
  ADD CONSTRAINT students_alumno_type_check
  CHECK (alumno_type IN ('estudiante', 'particular', 'trabajador'));

CREATE INDEX IF NOT EXISTS idx_students_alumno_type ON students (alumno_type);
