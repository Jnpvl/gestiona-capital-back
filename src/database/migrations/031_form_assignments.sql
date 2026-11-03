-- Formularios NOM-035: asignaciones por empresa y respuestas por empleado.
CREATE TABLE IF NOT EXISTS form_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  form_keys TEXT[] NOT NULL,
  due_at TIMESTAMPTZ,
  created_by_staff_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_assignments_company
  ON form_assignments (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES form_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  form_key VARCHAR(40) NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  score JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, student_id, form_key)
);

CREATE INDEX IF NOT EXISTS idx_form_responses_assignment
  ON form_responses (assignment_id, status);
CREATE INDEX IF NOT EXISTS idx_form_responses_student
  ON form_responses (student_id);
