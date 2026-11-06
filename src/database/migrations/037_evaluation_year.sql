-- Año de evaluación NOM-035: permite repetir guías año con año y filtrar el dashboard.

ALTER TABLE form_assignments
  ADD COLUMN IF NOT EXISTS evaluation_year INT;

UPDATE form_assignments
   SET evaluation_year = EXTRACT(YEAR FROM created_at)::INT
 WHERE evaluation_year IS NULL;

ALTER TABLE form_assignments
  ALTER COLUMN evaluation_year SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_assignments_company_year
  ON form_assignments (company_id, evaluation_year DESC);

ALTER TABLE employee_guia5_data
  ADD COLUMN IF NOT EXISTS evaluation_year INT;

UPDATE employee_guia5_data
   SET evaluation_year = EXTRACT(YEAR FROM COALESCE(completed_at, created_at))::INT
 WHERE evaluation_year IS NULL;

ALTER TABLE employee_guia5_data
  ALTER COLUMN evaluation_year SET NOT NULL;

ALTER TABLE employee_guia5_data
  DROP CONSTRAINT IF EXISTS employee_guia5_data_company_id_student_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'employee_guia5_data_company_student_year_key'
  ) THEN
    ALTER TABLE employee_guia5_data
      ADD CONSTRAINT employee_guia5_data_company_student_year_key
      UNIQUE (company_id, student_id, evaluation_year);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employee_guia5_company_year
  ON employee_guia5_data (company_id, evaluation_year DESC);
