-- Psicólogos de la empresa (compartidos entre empleados) y canalización por empleado/año.

CREATE TABLE IF NOT EXISTS company_psychologists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  license VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_psychologists_license
  ON company_psychologists (company_id, LOWER(license));

CREATE INDEX IF NOT EXISTS idx_company_psychologists_company
  ON company_psychologists (company_id);

CREATE TABLE IF NOT EXISTS employee_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  evaluation_year INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pendiente',
  closure_psychologist_id UUID REFERENCES company_psychologists(id) ON DELETE RESTRICT,
  conclusion TEXT,
  recommendations TEXT,
  resolution VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, student_id, evaluation_year)
);

CREATE INDEX IF NOT EXISTS idx_employee_referrals_company_year
  ON employee_referrals (company_id, evaluation_year);

CREATE TABLE IF NOT EXISTS employee_referral_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES employee_referrals(id) ON DELETE CASCADE,
  psychologist_id UUID NOT NULL REFERENCES company_psychologists(id) ON DELETE RESTRICT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Programada',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_referral_sessions_referral
  ON employee_referral_sessions (referral_id);

CREATE INDEX IF NOT EXISTS idx_employee_referral_sessions_psychologist
  ON employee_referral_sessions (psychologist_id);
