-- Nuevo rol oculto: solo seed/migración, no asignable desde el panel.
ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'super_admin';
