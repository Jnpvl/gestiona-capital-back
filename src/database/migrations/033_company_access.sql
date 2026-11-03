-- Acceso de empresa (login "¿Eres empresa?"): correo y contraseña en la propia empresa.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS access_email VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS access_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_access_email
  ON companies (LOWER(access_email))
  WHERE access_email IS NOT NULL;
