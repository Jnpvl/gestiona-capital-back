-- Último envío del correo de accesos (usuario + contraseña nueva) desde el admin.
ALTER TABLE students ADD COLUMN IF NOT EXISTS access_email_sent_at TIMESTAMPTZ;
