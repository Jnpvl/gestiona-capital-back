-- Super admin oculto (no visible ni editable por administradores normales).
INSERT INTO staff (
  name,
  paternal_last_name,
  maternal_last_name,
  first_names,
  email,
  password_hash,
  role,
  active
)
VALUES (
  'Juan Pablo',
  'VL',
  NULL,
  'Juan Pablo',
  'juanpi_vl@outlook.com',
  '$2b$12$ge2DvQUQhjWuLU4MAMFKauwFx6cZ/SoxRua.G87PuWt..pf.9TA4a',
  'super_admin',
  TRUE
)
ON CONFLICT (email) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  role = 'super_admin',
  active = TRUE,
  name = EXCLUDED.name,
  paternal_last_name = EXCLUDED.paternal_last_name,
  first_names = EXCLUDED.first_names,
  updated_at = NOW();
