-- NOM-035 Guía V (datos generales del trabajador). La llena solo el admin
-- desde la carga masiva de empleados; el empleado nunca la contesta.
CREATE TABLE IF NOT EXISTS employee_guia5_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  updated_by_staff_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_guia5_company
  ON employee_guia5_data (company_id);
