-- Actividad principal de la empresa: campo para identificar el giro/negocio

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS activity_main VARCHAR(100);

UPDATE companies
   SET activity_main = ''
 WHERE activity_main IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_activity_main
  ON companies (activity_main);
